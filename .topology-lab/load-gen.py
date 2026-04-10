#!/usr/bin/env python3
"""
Topology lab traffic generator.

Drives time-varying TCP load across all 6 spine-leaf links in BOTH directions
so SNMP interface counters show realistic bidirectional utilization patterns.

Each link gets two independent TCP flows:
  - Forward: spine  → leaf  (server on leaf,  port 52xx)
  - Reverse: leaf   → spine (server on spine, port 53xx)

This gives both ifHCInOctets and ifHCOutOctets meaningful values on every
interface, exercising all five weathermap utilization bands.

Usage:
    python3 .topology-lab/load-gen.py [--max-mbps 100] [--interval 30]

Press Ctrl+C to stop and clean up.
"""

import argparse
import math
import random
import signal
import subprocess
import sys
import time

# ---------------------------------------------------------------------------
# Topology
# ---------------------------------------------------------------------------

CONTAINERS = [
    "topo-spine-01",
    "topo-spine-02",
    "topo-leaf-01",
    "topo-leaf-02",
    "topo-leaf-03",
]

# Forward links: spine sends to leaf.
# (src_container, src_bind_ip, dst_container, dst_bind_ip, fwd_port, link_idx)
FWD_LINKS = [
    ("topo-spine-01", "10.101.1.1", "topo-leaf-01", "10.101.1.2", 5201, 0),
    ("topo-spine-01", "10.101.2.1", "topo-leaf-02", "10.101.2.2", 5202, 1),
    ("topo-spine-01", "10.101.3.1", "topo-leaf-03", "10.101.3.2", 5203, 2),
    ("topo-spine-02", "10.101.4.1", "topo-leaf-01", "10.101.4.2", 5204, 3),
    ("topo-spine-02", "10.101.5.1", "topo-leaf-02", "10.101.5.2", 5205, 4),
    ("topo-spine-02", "10.101.6.1", "topo-leaf-03", "10.101.6.2", 5206, 5),
]

# Reverse links: leaf sends to spine.
# (src_container, src_bind_ip, dst_container, dst_bind_ip, rev_port, link_idx)
REV_LINKS = [
    ("topo-leaf-01", "10.101.1.2", "topo-spine-01", "10.101.1.1", 5301, 0),
    ("topo-leaf-02", "10.101.2.2", "topo-spine-01", "10.101.2.1", 5302, 1),
    ("topo-leaf-03", "10.101.3.2", "topo-spine-01", "10.101.3.1", 5303, 2),
    ("topo-leaf-01", "10.101.4.2", "topo-spine-02", "10.101.4.1", 5304, 3),
    ("topo-leaf-02", "10.101.5.2", "topo-spine-02", "10.101.5.1", 5305, 4),
    ("topo-leaf-03", "10.101.6.2", "topo-spine-02", "10.101.6.1", 5306, 5),
]

ALL_CONTAINERS = CONTAINERS

# iperf3 is baked into the topology-node image for all containers.
IPERF3 = {c: "/usr/bin/iperf3" for c in ALL_CONTAINERS}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(cmd: str, check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)


def pexec(container: str, sh_cmd: str) -> subprocess.CompletedProcess:
    """Run sh_cmd inside container, return result."""
    return run(f"podman exec {container} sh -c {repr(sh_cmd)}")


def pexec_bg(container: str, sh_cmd: str) -> None:
    """Run sh_cmd inside container in the background (fire-and-forget)."""
    run(f"podman exec -d {container} sh -c {repr(sh_cmd)}")


# ---------------------------------------------------------------------------
# Bandwidth shape function
# ---------------------------------------------------------------------------

def target_mbps(link_idx: int, t: float, max_mbps: float) -> float:
    """
    Return a target bandwidth in Mbit/s for the given link at time t.

    Combines three overlapping sine waves at different periods and phases
    so each link has a distinct, non-repeating-looking pattern, plus
    uniform noise and rare saturation spikes.

      - Slow wave  : 5-minute period, drives the broad utilization envelope
      - Medium wave: 2-minute period, mid-frequency ripple
      - Fast wave  : 45-second period, short bursts

    Result is clamped to [2%, 98%] of max_mbps.
    """
    # Each link gets a unique phase so the 6 links don't all peak together
    phi = link_idx * math.pi / 3.0

    slow   =  0.40 * math.sin(2 * math.pi * t / 300.0 + phi)
    medium =  0.15 * math.sin(2 * math.pi * t / 120.0 + phi * 1.7)
    fast   =  0.05 * math.sin(2 * math.pi * t /  45.0 + phi * 2.3)
    noise  =  0.08 * random.uniform(-1.0, 1.0)

    # Raw utilization fraction: centred around 0.45, range roughly 0.02–0.88
    frac = 0.45 + slow + medium + fast + noise

    # Occasional saturation spike: ~5% chance per link per interval
    if random.random() < 0.05:
        frac = random.uniform(0.85, 0.97)

    frac = max(0.02, min(0.98, frac))
    return frac * max_mbps


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def install_iperf3() -> None:
    print("Checking iperf3 on all containers...")
    for c in ALL_CONTAINERS:
        bin_path = IPERF3[c]
        r = pexec(c, f"{bin_path} --version 2>&1 | head -1")
        if r.returncode == 0:
            status = r.stdout.strip() or "ok"
        else:
            r2 = pexec(c, "apk add -q --no-cache iperf3")
            status = "installed via apk" if r2.returncode == 0 else f"MISSING — copy binary to {bin_path}"
        print(f"  {c}: {status}")


def stop_iperf3() -> None:
    """Kill all iperf3 processes in all containers (servers and clients)."""
    for c in ALL_CONTAINERS:
        bin_path = IPERF3[c]
        pexec(c, f"pkill -f '{bin_path}' 2>/dev/null; pkill -f iperf3 2>/dev/null; true")


def start_servers() -> None:
    print("Starting iperf3 servers (forward: leaves, reverse: spines)...")
    time.sleep(0.5)  # let pkill settle

    # Forward servers on leaves
    for src, src_ip, dst, dst_ip, port, idx in FWD_LINKS:
        bin_path = IPERF3[dst]
        cmd = (
            f"nohup {bin_path} -s -B {dst_ip} -p {port} "
            f"--logfile /tmp/iperf3-server-{port}.log "
            f">/dev/null 2>&1 &"
        )
        r = pexec(dst, cmd)
        status = "ok" if r.returncode == 0 else f"FAILED: {r.stderr.strip()}"
        print(f"  fwd-server {dst} {dst_ip}:{port}  {status}")

    # Reverse servers on spines
    for src, src_ip, dst, dst_ip, port, idx in REV_LINKS:
        bin_path = IPERF3[dst]
        cmd = (
            f"nohup {bin_path} -s -B {dst_ip} -p {port} "
            f"--logfile /tmp/iperf3-server-{port}.log "
            f">/dev/null 2>&1 &"
        )
        r = pexec(dst, cmd)
        status = "ok" if r.returncode == 0 else f"FAILED: {r.stderr.strip()}"
        print(f"  rev-server {dst} {dst_ip}:{port}  {status}")

    time.sleep(0.5)  # give servers a moment to bind


# ---------------------------------------------------------------------------
# Traffic loop
# ---------------------------------------------------------------------------

def fire_clients(t: float, interval: int, max_mbps: float) -> None:
    # Kill previous client wave first
    for c in ALL_CONTAINERS:
        bin_path = IPERF3[c]
        pexec(c, f"pkill -f '{bin_path} -c' 2>/dev/null; pkill -f 'iperf3 -c' 2>/dev/null; true")
    time.sleep(0.3)

    print(f"\n[{time.strftime('%H:%M:%S')}] Link utilization (TCP bidirectional):")

    # Forward flows: spine → leaf
    for src, src_ip, dst, dst_ip, port, idx in FWD_LINKS:
        bw = target_mbps(idx, t, max_mbps)
        bin_path = IPERF3[src]
        cmd = (
            f"nohup {bin_path} -c {dst_ip} -p {port} "
            f"-b {bw:.2f}M "
            f"-t {interval + 5} "
            f"-B {src_ip} "
            f"--logfile /tmp/iperf3-client-{port}.log "
            f">/dev/null 2>&1 &"
        )
        pexec(src, cmd)
        bar_len = int(bw / max_mbps * 30)
        bar = "#" * bar_len + "." * (30 - bar_len)
        print(f"  fwd {src} → {dst_ip}:{port}  [{bar}] {bw:5.1f}/{max_mbps:.0f} Mbit/s")

    # Reverse flows: leaf → spine
    for src, src_ip, dst, dst_ip, port, idx in REV_LINKS:
        bw = target_mbps(idx, t + 7, max_mbps)  # offset phase slightly for asymmetry
        bin_path = IPERF3[src]
        cmd = (
            f"nohup {bin_path} -c {dst_ip} -p {port} "
            f"-b {bw:.2f}M "
            f"-t {interval + 5} "
            f"-B {src_ip} "
            f"--logfile /tmp/iperf3-rclient-{port}.log "
            f">/dev/null 2>&1 &"
        )
        pexec(src, cmd)
        bar_len = int(bw / max_mbps * 30)
        bar = "#" * bar_len + "." * (30 - bar_len)
        print(f"  rev {src} → {dst_ip}:{port}  [{bar}] {bw:5.1f}/{max_mbps:.0f} Mbit/s")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-mbps", type=float, default=100.0,
                        help="Virtual link speed in Mbit/s (default: 100)")
    parser.add_argument("--interval", type=int, default=30,
                        help="Seconds between rate updates (default: 30)")
    args = parser.parse_args()

    def cleanup(sig, frame):
        print("\n\nShutting down — killing iperf3 in all containers...")
        stop_iperf3()
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("=== Topology Lab Traffic Generator ===")
    print(f"  Links     : {len(FWD_LINKS)} forward + {len(REV_LINKS)} reverse = {len(FWD_LINKS)*2} total flows")
    print(f"  Max speed : {args.max_mbps:.0f} Mbit/s per direction")
    print(f"  Interval  : {args.interval}s")
    print(f"  Protocol  : TCP (reliable bidirectional, no UDP loss)")
    print()

    stop_iperf3()
    install_iperf3()
    start_servers()

    print(f"\nGenerating traffic — Ctrl+C to stop.\n")

    while True:
        fire_clients(time.time(), args.interval, args.max_mbps)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
