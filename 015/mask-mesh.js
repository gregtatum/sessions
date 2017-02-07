const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const quad = require('../common/quads')
const createRandom = require('@tatumcreative/random')
const simplex = new (require('simplex-noise'))(createRandom(0))

const ORIGIN = [0, 0, 0]
const TAU = 6.283185307179586

module.exports = function createMesh (configIn) {
  const config = Object.assign({
    radius: 0.015,
    w: 0.25,
    h: 0.3,
    d: 0.05,
    antlerDepth: 7,
    antlerShrink: 0.75,
    antlerLength: 0.015,
    initialAntlerExtrude: 0.01,
    antlersScale: 2,
    antlersRotation: 0.3,
    antlersOutward: 0.04,
    antlersWaveAmount: 0.05,
    simplexOffset: 0,
    simplexAmount: 0.00,
    simplexScale: 5,
    x: 0,
    y: 0,
    z: 0,
  }, configIn)

  const { w, h, d } = config

  // Create a box.
  let mesh = quad.createBox(w, h, d)
  mesh.positions.forEach(p => p[1] -= 0.07)

  quad.splitLoop(mesh, mesh.cells[3], 0.2, true)
  // Split the box in half.
  const centerRing = quad.getNewGeometry(mesh, "positions", () => {
    quad.splitLoop(mesh, mesh.cells[3], 0.6)
    quad.splitLoop(mesh, mesh.cells[3], 0.75)
  })
  createEyeHoles(mesh, w, h, d)
  bendMask(mesh, 0.5)
  shearMask(mesh, 0.2)
  extrudeMouth(mesh)

  generateBothAntlers(mesh, config)

  quad.subdivide(mesh, 3)

  mesh.positions.forEach(position => {
    const {x, y, z, simplexAmount, simplexScale: s, simplexOffset: o} = config
    position[0] += x + simplex.noise3D(o + s * position[0], s * position[1], s * position[2]) * simplexAmount
    position[1] += y + simplex.noise3D(o + s * position[0], s * position[1], s * position[2]) * simplexAmount
    position[2] += z + simplex.noise3D(o + s * position[0], s * position[1], s * position[2]) * simplexAmount
  })
  return mesh
}

function squareCell (mesh, cell, size, direction) {
  const center = quad.computeCellCenter(mesh, cell)

  const positions = cell.map(i => mesh.positions[i])
  positions.forEach(position => {
    position[1] = center[1]
  })
  positions[0][0] = center[0] + size * direction
  positions[1][0] = center[0] + size * direction
  positions[2][0] = center[0] - size * direction
  positions[3][0] = center[0] - size * direction
  positions[0][2] = center[2] + size * direction
  positions[1][2] = center[2] - size * direction
  positions[2][2] = center[2] - size * direction
  positions[3][2] = center[2] + size * direction
}

function createAntler (mesh, tipCell, config, direction) {
  let { radius, antlerDepth, antlerShrink, antlerLength, antlersOutward, antlersWaveAmount } = config
  let length = antlerLength
  let branch = direction > 0 ? 0 : 8 * 1000 - 2
  let branchRotation = 0.3
  let shrinkage = 0.1

  const antlerPositions = quad.getNewGeometry(mesh, "positions", () => {
    createAntlerSection(mesh, tipCell, radius, length, branch, branchRotation, shrinkage)

    for (let i = 0; i < antlerDepth; i++) {
      radius *= 0.4
      length *= antlerShrink
      branch += direction * 1
      // branchRotation = 0.2
      createAntlerSection(mesh, tipCell, radius, length, branch, branchRotation, shrinkage)
    }

    quad.extrude(mesh, tipCell, 0.5, length * 3)
  })

  const lowestPosition = antlerPositions.reduce((a, b) => Math.min(a, b[1]), Infinity)
  const highestPosition = antlerPositions.reduce((a, b) => Math.max(a, b[1]), -Infinity)
  const positionHeight = highestPosition - lowestPosition

  antlerPositions.forEach(position => {
    const unitHeight = (position[1] - lowestPosition) / positionHeight
    position[0] += direction * antlersWaveAmount * Math.sin(unitHeight * Math.PI)
    vec3.rotateY(position, position, ORIGIN, direction * unitHeight * Math.PI * 0.5)
    position[0] += direction * antlersOutward
  })

  return mesh
}

function createAntlerSection (mesh, tipCell, radius, length, branch, branchRotation, shrinkage) {
  // Make the initial extrusion
  quad.extrude(mesh, tipCell, shrinkage, length)
  const branchCells = quad.getNewGeometry(mesh, "cells", () => {
    quad.extrude(mesh, tipCell, 0, length / 4)
  })
  quad.extrude(mesh, tipCell, 0, length / 2)

  // Branch the antler up
  extrudeAntlerBranchUp(mesh, branchCells[branch % branchCells.length], tipCell, branchRotation, length)

  return mesh
}

function extrudeAntlerBranchUp (mesh, branchCell, cellCenter, branchRotation, length) {
  const branchNormal = quad.getCellNormal(mesh, branchCell, [])
  const binormal = vec3.cross([], branchNormal, [0, 1, 0])
  const rotationCenter = quad.computeCellCenter(mesh, cellCenter)
  const rotationMatrix = mat4.identity([])

  for (let i = 0; i < 2; i++) {
    quad.extrude(mesh, branchCell, branchRotation, length / 2)

    mat4.rotate(rotationMatrix, rotationMatrix, branchRotation, binormal)
    branchCell.forEach(positionIndex => {
      applyRotationMatrixFromPoint(mesh.positions[positionIndex], rotationMatrix, rotationCenter)
    })
  }
}

function applyRotationMatrixFromPoint (position, rotationMatrix, center) {
  position[0] = position[0] - center[0]
  position[1] = position[1] - center[1]
  position[2] = position[2] - center[2]

  vec3.transformMat4(position, position, rotationMatrix)

  position[0] = position[0] + center[0]
  position[1] = position[1] + center[1]
  position[2] = position[2] + center[2]

  return position
}

function bendMask ({positions}, amount) {
  const xs = positions.map(([x, y, z]) => x)
  const minX = xs.reduce((a, b) => Math.min(a, b))
  const maxX = xs.reduce((a, b) => Math.max(a, b))
  const xRange = maxX - minX
  const bendAmount = xRange * amount
  positions.forEach(p => {
    p[2] += Math.cos(p[0] * Math.PI / xRange) * bendAmount - bendAmount * 0.5
  })
}

function shapeMaskBack (mesh) {
  ;[0, 3].forEach(i => {
    mesh.positions[i][0] *= 1.2
    mesh.positions[i][1] -= 0.1
    mesh.positions[i][2] -= 0.1
  })
}

function createEyeHoles (mesh, w, h, d) {
  // Create some eye-holes.
  const leftEyeFrontIndex = 6
  const leftEyeBackIndex = 8
  const rightEyeFrontIndex = 15
  const rightEyeBackIndex = 13
  const leftEyeFront = mesh.cells[leftEyeFrontIndex]
  const leftEyeBack = mesh.cells[leftEyeBackIndex]
  const rightEyeFront = mesh.cells[rightEyeFrontIndex]
  const rightEyeBack = mesh.cells[rightEyeBackIndex]

  quad.inset(mesh, leftEyeFront, 0.5)
  quad.inset(mesh, leftEyeBack, 0.5)
  quad.inset(mesh, rightEyeFront, 0.5)
  quad.inset(mesh, rightEyeBack, 0.5)

  quad.extrude(mesh, leftEyeFront, 0, 0)
  quad.extrude(mesh, rightEyeFront, 0, 0)

  leftEyeFront.forEach(i => mesh.positions[i][2] = -d / 2)
  rightEyeFront.forEach(i => mesh.positions[i][2] = -d / 2)

  mesh.cells.splice(leftEyeBackIndex, 1)
  mesh.cells.splice(leftEyeFrontIndex, 1)
  mesh.cells.splice(rightEyeBackIndex, 1)
  mesh.cells.splice(11, 1)
  quad.mergePositions(mesh)
}

function shapeNose (mesh) {
  ;[42, 43, 46].forEach(i => {
    mesh.positions[i][2] -= 0.05
  })

  quad.splitLoop(mesh, mesh.cells[25], 0.2, true)

  ;[230, 231, 232].forEach(i => {
    mesh.positions[i][0] *= 2
    mesh.positions[i][1] += 0.05
    mesh.positions[i][2] += 0.05
  })
}

function extrudeAndRotateCell (mesh, cell, random) {
  quad.extrude(mesh, cell, 0.5, 0.025)
  const range = 0.4
  const rotateA = random() * range - range / 2
  const rotateB = random() * range - range / 2

  cell.forEach(i => {
    const position = mesh.positions[i]
    vec3.rotateZ(position, position, [0, 0, 0], rotateA)
    vec3.rotateY(position, position, [0, 0, 0], rotateB)
    position[2] -= 0.1
  })
}

function unique(value, index, self) {
  return self.indexOf(value) === index
}

function extrudeMouth (mesh) {
  const mouthCellIndex = 13
  const mouthCell = mesh.cells[mouthCellIndex]
  const mouthPositions = mouthCell.map(i => mesh.positions[i])

  const sideOfJawPositions = [0, 1, 2, 3]
  sideOfJawPositions.forEach(i => {
    mesh.positions[i][0] *= 0.5
    mesh.positions[i][1] += 0.0
    mesh.positions[i][2] += 0.05
  })

  const center = quad.computeCellCenter(mesh, mouthCell)
  mouthPositions.forEach(position => {
    // vec3.rotateX(position, position, center, -TAU * 0.1)
    position[1] -= 0.1
  })

  quad.extrude(mesh, mouthCell, 0.5, -0.05)
  // mouthCell.forEach(i => mesh.positions[i][2] -= 0.02)
  // quad.extrude(mesh, mouthCell, 0.5, -0.01)

  const mouthFrontPositions = [12, 18]
  mouthFrontPositions.forEach(i => {
    mesh.positions[i][1] += 0.12
    mesh.positions[i][2] += 0.01
  })

  // quad.subdivide(mesh, 1)

}

function shearMask (mesh, amount) {
  mesh.positions.forEach(p => p[2] -= p[1] * amount)
}

function generateBothAntlers (mesh, config) {
  const leftCell = mesh.cells[0]
  const rightCell = mesh.cells[11]
  const leftCenter = quad.computeCellCenter(mesh, leftCell)
  const rightCenter = quad.computeCellCenter(mesh, rightCell)

  const leftAntlers = quad.getNewGeometry(mesh, "positions", () => {
    squareCell(mesh, leftCell, 0.03, -1)
    quad.extrude(mesh, leftCell, 0.5, config.initialAnterExtrude)
    quad.extrude(mesh, leftCell, 0.2, config.initialAntlerExtrude * 0.1)
    createAntler(mesh, leftCell, config, -1)
  })

  const rightAntlers = quad.getNewGeometry(mesh, "positions", () => {
    squareCell(mesh, rightCell, 0.03, -1)
    quad.extrude(mesh, rightCell, 0.5, config.initialAnterExtrude)
    quad.extrude(mesh, rightCell, 0.2, config.initialAntlerExtrude * 0.1)
    createAntler(mesh, rightCell, config, 1)
  })

  sizeAntlers(mesh, leftAntlers, leftCenter, 1, config)
  sizeAntlers(mesh, rightAntlers, rightCenter, -1, config)
}

function sizeAntlers (mesh, positions, center, direction, config) {
  const { antlersScale, antlersRotation } = config
  positions.forEach(position => {
    vec3.rotateZ(position, position, center, antlersRotation * direction)
    vec3.scale(position, position, antlersScale)
  })
}
