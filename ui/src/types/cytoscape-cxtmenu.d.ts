declare module 'cytoscape-cxtmenu' {
  import cytoscape from 'cytoscape'
  const register: (cy: typeof cytoscape) => void
  export default register
}
