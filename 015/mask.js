const glsl = require('glslify')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const quad = require('../common/quads')
const ORIGIN = [0, 0, 0]

module.exports = function (regl) {
  const mesh = createMesh()

  return {
    drawMask: createDrawMask(regl, mesh),
    maskQuads: mesh
  }
}

function createDrawMask (regl, mesh) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      varying vec3 vNormal;

      void main() {
        vNormal = normal;
        gl_Position = projection * view * vec4(position * 0.4, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform vec3 cameraPosition;
      uniform sampler2D matcapTexture;
      varying vec3 vNormal;

      void main() {
        vec3 normal = normalize(vNormal);
        vec2 uv = matcap(cameraPosition, normal);
        vec3 color = texture2D(matcapTexture, uv).rgb;
        gl_FragColor = vec4(color * 0.6, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      matcapTexture: regl.prop('matcapTexture'),
      model: regl.context('headModel')
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
    primitive: 'triangle',
    cull: { enable: true }
  })
}

function createMesh () {
  // Create a box.
  const w = 0.25
  const h = 0.3
  const d = 0.05
  let mesh = quad.createBox(w, h, d)
  mesh.positions.forEach(p => {
    p[1] -= 0.07
  })

  quad.splitLoop(mesh, mesh.cells[3], 0.2, true)
  // Split the box in half.
  quad.splitLoop(mesh, mesh.cells[3], 0.6)
  quad.splitLoop(mesh, mesh.cells[3], 0.75)

  createEyeHoles(mesh, w, h, d)
  bendMask(mesh, 0.5)
  shearMask(mesh, 0.2)
  extrudeMouth(mesh)

  generateBothAntlers(mesh)

  quad.subdivide(mesh, 3)

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

function createAntler (mesh, tipCell, radius, direction) {
  let length = 0.015
  let branch = direction > 0 ? 0 : 8 * 1000 - 2
  let branchRotation = 0.3
  let shrinkage = 0.1

  const antlerPositions = quad.getNewGeometry(mesh, 'positions', () => {
    createAntlerSection(mesh, tipCell, radius, length, branch, branchRotation, shrinkage)

    for (let i = 0; i < 7; i++) {
      radius *= 0.4
      length *= 0.75
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
    position[0] += direction * 0.05 * Math.sin(unitHeight * Math.PI)
    vec3.rotateY(position, position, ORIGIN, direction * unitHeight * Math.PI * 0.5)
    position[0] += direction * 0.04
  })

  return mesh
}

function createAntlerSection (mesh, tipCell, radius, length, branch, branchRotation, shrinkage) {
  // Make the initial extrusion
  quad.extrude(mesh, tipCell, shrinkage, length)
  const branchCells = quad.getNewGeometry(mesh, 'cells', () => {
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

  leftEyeFront.forEach(i => {
    mesh.positions[i][2] = -d / 2
  })
  rightEyeFront.forEach(i => {
    mesh.positions[i][2] = -d / 2
  })

  mesh.cells.splice(leftEyeBackIndex, 1)
  mesh.cells.splice(leftEyeFrontIndex, 1)
  mesh.cells.splice(rightEyeBackIndex, 1)
  mesh.cells.splice(11, 1)
  quad.mergePositions(mesh)
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

  mouthPositions.forEach(position => {
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
  mesh.positions.forEach(p => {
    p[2] -= p[1] * amount
  })
}

function generateBothAntlers (mesh, radius) {
  const leftCell = mesh.cells[0]
  const rightCell = mesh.cells[11]
  const leftCenter = quad.computeCellCenter(mesh, leftCell)
  const rightCenter = quad.computeCellCenter(mesh, rightCell)

  const leftAntlers = quad.getNewGeometry(mesh, 'positions', () => {
    squareCell(mesh, leftCell, 0.03, -1)
    quad.extrude(mesh, leftCell, 0.5, 0.01)
    quad.extrude(mesh, leftCell, 0.2, 0.001)
    createAntler(mesh, leftCell, radius, -1)
  })

  const rightAntlers = quad.getNewGeometry(mesh, 'positions', () => {
    squareCell(mesh, rightCell, 0.03, -1)
    quad.extrude(mesh, rightCell, 0.5, 0.01)
    quad.extrude(mesh, rightCell, 0.2, 0.001)
    createAntler(mesh, rightCell, radius, 1)
  })

  sizeAntlers(mesh, leftAntlers, leftCenter, 1)
  sizeAntlers(mesh, rightAntlers, rightCenter, -1)
}

function sizeAntlers (mesh, positions, center, direction) {
  const ys = positions.map(p => p[1])
  const maxY = ys.reduce((a, b) => Math.max(a, b))
  const minY = ys.reduce((a, b) => Math.min(a, b))
  const rangeY = maxY - minY

  positions.forEach(position => {
    const unitY = (position[1] - minY) / rangeY
    vec3.rotateZ(position, position, center, 0.3 * direction)
    vec3.rotateX(position, position, center, -0.3 * (1 - unitY))
    position[2] += -0.02
    scaleFromPoint(position, center, 2)
  })
}

function scaleFromPoint (point, center, scale) {
  point[0] = (point[0] - center[0]) * scale + center[0]
  point[1] = (point[1] - center[1]) * scale + center[1]
  point[2] = (point[2] - center[2]) * scale + center[2]
}
