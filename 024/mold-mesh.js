const quad = require('../common/quads')
const subdivide = require('../common/catmull-clark')
const { cos, sin } = Math
const lerp = require('lerp')
const simplex = new (require('simplex-noise'))()
const vec3 = require('gl-vec3')
const createRandom = require('@tatumcreative/random')

module.exports = function createGeometry () {
  const config = {
    width: 0.8,
    inset: 0.1,
    extrude: 0.010,
    extrusionCount: 5,
    randomHash: '1',
  }
  const random = createRandom(config.randomHash);
  const { mesh, cell } = quad.createQuad({ w: config.width, h: config.width })
  subdivide(mesh, 3)
  quad.computeNormals(mesh)

  for (const cell of mesh.cells.slice()) {
    const height = random(0.4, 1.5)
    const width = random(0.4, 1.5)
    const extrude = (insetFactor, extrudeFactor) => quad.extrude(
      mesh,
      cell,
      config.inset * insetFactor * width,
      config.extrude * extrudeFactor * config.width * height
    )
    extrude(4, 0.5)
    extrude(4, 1)
    extrude(-4, 2)
    extrude(1, 2)
  }
  subdivide(mesh, 2)
  quad.computeNormals(mesh)

  const labels = createLabels(config, mesh)
  let maxHeight = 0;
  for (const [,y,] of mesh.positions) {
    maxHeight = Math.max(maxHeight, y)
  }

  return Object.assign({ labels, maxHeight }, mesh, config);
}

/**
 * Go through each growth area, and label the knob with a unique id.
 */
function createLabels (config, mesh) {
  const thresholdHeight = config.extrude;
  const positionIndexes = mesh.positions.map((_, i) => i)
  const labeledIndexes = new Set();
  const positionToCells = new Map();
  const labels = []

  // Label all the positions near the bottom as 0
  for (const index of positionIndexes) {
    const position = mesh.positions[index];
    if (position[1] < thresholdHeight) {
      labels[index] = 0;
      labeledIndexes.add(index);
    }
  }

  // Build the map of positions to cells.
  for (const cell of mesh.cells) {
    for (const positionIndex of cell) {
      let cells = positionToCells.get(positionIndex);
      if (!cells) {
        cells = []
        positionToCells.set(positionIndex, cells);
      }
      cells.push(cell)
    }
  }


  let label = 0;
  function labelSelfAndNeighbors(index) {
    labels[index] = label;
    labeledIndexes.add(index);
    for (const cell of positionToCells.get(index)) {
      for (const otherIndex of cell) {
        if (!labeledIndexes.has(otherIndex)) {
          labelSelfAndNeighbors(otherIndex);
        }
      }
    }
  }

  for (const index of positionIndexes) {
    const position = mesh.positions[index];
    if (labeledIndexes.has(index)) {
      continue;
    }
    // Create a new label
    label++;
    labelSelfAndNeighbors(index);
  }

  return labels;
}
