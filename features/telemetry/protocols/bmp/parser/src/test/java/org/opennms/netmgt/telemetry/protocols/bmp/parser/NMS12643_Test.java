/*******************************************************************************
 * This file is part of OpenNMS(R).
 *
 * Copyright (C) 2020 The OpenNMS Group, Inc.
 * OpenNMS(R) is Copyright (C) 1999-2020 The OpenNMS Group, Inc.
 *
 * OpenNMS(R) is a registered trademark of The OpenNMS Group, Inc.
 *
 * OpenNMS(R) is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * OpenNMS(R) is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with OpenNMS(R).  If not, see:
 *      http://www.gnu.org/licenses/
 *
 * For more information contact:
 *     OpenNMS(R) Licensing <license@opennms.org>
 *     http://www.opennms.org/
 *     http://www.opennms.com/
 *******************************************************************************/

package org.opennms.netmgt.telemetry.protocols.bmp.parser;

import static org.opennms.netmgt.telemetry.listeners.utils.BufferUtils.slice;

import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

import org.junit.Test;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.Header;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.Packet;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.PeerAccessor;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.PeerHeader;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.PeerInfo;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.packets.InitiationPacket;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.packets.PeerDownPacket;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.packets.PeerUpPacket;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.packets.RouteMirroringPacket;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.packets.RouteMonitoringPacket;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.packets.StatisticsReportPacket;
import org.opennms.netmgt.telemetry.protocols.bmp.parser.proto.bmp.packets.TerminationPacket;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;

public class NMS12643_Test implements Packet.Visitor {
    private final static Path FILE = Paths.get("src/test/resources/NMS-12643.raw");

    @Test
    public void testMpUnreachNlri() throws Exception {
        try (final FileChannel channel = FileChannel.open(FILE)) {
            final ByteBuffer buffer = ByteBuffer.allocate((int) channel.size());
            channel.read(buffer);
            buffer.flip();
            final ByteBuf buf = Unpooled.wrappedBuffer(buffer);
            while(buf.readableBytes() > 0) {
                final Header header = new Header(slice(buf, Header.SIZE));
                final Packet packet = header.parsePayload(slice(buf, header.length - Header.SIZE), new PeerAccessor() {
                    @Override
                    public Optional<PeerInfo> getPeerInfo(PeerHeader peerHeader) {
                        return Optional.empty();
                    }
                });
                packet.accept(this);
            }
        }
    }

    @Override
    public void visit(InitiationPacket packet) {
    }

    @Override
    public void visit(TerminationPacket packet) {
    }

    @Override
    public void visit(PeerUpPacket packet) {
    }

    @Override
    public void visit(PeerDownPacket packet) {
    }

    @Override
    public void visit(StatisticsReportPacket packet) {
    }

    @Override
    public void visit(RouteMonitoringPacket packet) {
    }

    @Override
    public void visit(RouteMirroringPacket packet) {
    }
}
