const quad = require('../common/quads')
const { cos, sin } = Math
const lerp = require('lerp')
const simplex = new (require('simplex-noise'))()
const vec3 = require('gl-vec3')

module.exports = function createGeometry () {
  const stalkHeight = 0.4
  const stalkRatio = 0.2
  const stalkWidth = stalkHeight * stalkRatio

  const config = {
    stalkHeight,
    stalkRatio,
    stalkWidth,
    headHeight: stalkWidth,
    headWidthRatio: 6,
    capReductionRatio: 0.3,
    topStalkWidth: 0.8,
    centerStalkWidth: 0.6,
    centerStalkRatio: 0.7,
  }

  const mesh = quad.createBox(stalkWidth, stalkHeight, stalkWidth)
  const head = splitOutMushroomHead(mesh, config)
  refineMushroomStalk(mesh, config)
  shapeMushroomHead(mesh, config, head)

  mesh.headBaseHeight = head.positions.reduce(
    (n, [x, y, z]) => Math.min(n, y),
    Infinity
  )

  mesh.yBounds = computeMeshYBounds(mesh)

  quad.subdivide(mesh, 3)
  const labels = labelMushroomParts(mesh)

  return Object.assign({}, mesh, config, labels)
}

function computeMeshYBounds (mesh) {
  let yLow = Infinity
  let yHigh = -Infinity
  mesh.positions.forEach(([x, y, z]) => {
    yLow = Math.min(y, yLow)
    yHigh = Math.max(y, yHigh)
  })
  return [yLow, yHigh]
}

function splitOutMushroomHead (mesh, config) {
  const { stalkRatio } = config
  quad.splitLoop(mesh, mesh.cells[2], 1 - stalkRatio)
  const headCells = [0, 6, 7, 8, 9].map(i => mesh.cells[i])
  const capCell = 0;
  const positions = flattenUnique(headCells).map(i => mesh.positions[i])
  const capPositions = mesh.cells[0].map(i => mesh.positions[i]);
  return { positions, capPositions }
}

function refineMushroomStalk (mesh, config) {
  const { centerStalkRatio, centerStalkWidth, topStalkWidth } = config
  const refinement = 0.02
  const stalkEdgeCell = mesh.cells[2];
  quad.splitLoop(mesh, stalkEdgeCell, 1 - refinement)
  const topStalkPositions = quad.getNewGeometry(mesh, 'positions', () => {
    quad.splitLoop(mesh, stalkEdgeCell, 1 - refinement * 2)
  })
  const centerStalkPositions = quad.getNewGeometry(mesh, 'positions', () => {
    quad.splitLoop(mesh, stalkEdgeCell, centerStalkRatio)
  })
  quad.splitLoop(mesh, stalkEdgeCell, refinement)
  centerStalkPositions.forEach(p => scaleXZ(p, centerStalkWidth))
  topStalkPositions.forEach(p => scaleXZ(p, topStalkWidth))
}

function shapeMushroomHead (mesh, config, head) {
  const { headWidthRatio, capReductionRatio, headHeight } = config
  head.positions.forEach(p => scaleXZ(p, headWidthRatio))
  head.capPositions.forEach(p => scaleXZ(p, capReductionRatio))
  head.positions.forEach(p => p[1] -= headHeight * 0.3)
}

function averageCellHeight (mesh, cell) {
  const positions = cell.map(i => mesh.positions[i])
  let height = 0
  positions.forEach(([x, y, z]) => height += y)
  return height / positions.length
}

function labelMushroomParts (mesh) {
  // This selects a vertical loop from the top most cell.
  const verticalLoop = quad.getLoop(mesh, mesh.cells[0], "cells")

  // Use the 6th cell in the loop, and selet the first true horizontal loop.
  const firstHorizontalLoop = quad.getLoop(mesh, verticalLoop[6], "cells", false)

  // This funky function takes a list of concurrent cells, and attempts to select the
  // loops around them.
  function expandLoop (cells, mod = 0) {
    function selectLoops (cell, index) {
      const flipFlopDirection = index % 2 === mod
      return quad.getLoop(mesh, cell, "cells", flipFlopDirection)
    }
    return flattenUnique(cells.map(selectLoops))
  }

  // Grow the selection to include all of the cells in the head
  const headTopCells = quad.growSelection(mesh, firstHorizontalLoop, 7)
  const headBottomCells = expandLoop(verticalLoop.slice(14, 25), 1)

  const STEM_LABEL = 0
  const HEAD_TOP_LABEL = 1
  const HEAD_BOTTOM_LABEL = 2

  const labels = Array(mesh.positions.length).fill(STEM_LABEL)
  headTopCells.forEach(cell => cell.forEach(p => labels[p] = HEAD_TOP_LABEL))
  headBottomCells.forEach(cell => cell.forEach(p => labels[p] = HEAD_BOTTOM_LABEL))
  return { labels, STEM_LABEL, HEAD_TOP_LABEL, HEAD_BOTTOM_LABEL }
}

function unique(value, index, self) {
  return self.indexOf(value) === index
}

function flattenUnique (tuples) {
  const reduction = []
  for (let i = 0; i < tuples.length; i++) {
    const tuple = tuples[i]
    for (let j = 0; j < tuple.length; j++) {
      const value = tuple[j]
      if (!reduction.includes(value)) {
        reduction.push(value)
      }
    }
  }
  return reduction
}

function scaleXZ (p, t) {
  p[0] *= t
  p[2] *= t
}
