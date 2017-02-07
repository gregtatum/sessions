const glsl = require('glslify')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const quad = require('../common/quads')
const createRandom = require('@tatumcreative/random')
const ORIGIN = [0, 0, 0]
const TAU = 6.283185307179586

module.exports = function (regl) {
  const mesh = createMesh()
  const centerPositions = quad.computeCenterPositions(mesh)

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
      uniform mat4 headModel, model, view, projection;
      uniform mat3 normalHeadModel, normalModel, normalView;
      uniform vec3 cameraPosition;
      varying vec3 vPosition, vNormal, vCameraVector;
      varying float vDepth;

      void main() {
        // Calculate global positioning
        vec4 globalPosition = model * headModel * vec4(position * 0.5, 1.0);
        gl_Position = projection * view * globalPosition;

        // Calculate varyings.
        vDepth = max(0.0, globalPosition.z + 0.5) + 0.2;
        vNormal = normalView * normalModel * normalHeadModel * normal;
        vCameraVector = normalView * (globalPosition.xyz - cameraPosition);
        vPosition = globalPosition.xyz;
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform mat4 view;
      uniform mat3 normalView;
      uniform sampler2D matcapTexture;
      varying vec3 vPosition, vNormal, vCameraVector;
      varying float vDepth;

      void main() {
        vec2 uv = matcap(
          normalize(vCameraVector),
          normalize(vNormal)
        );

        vec3 color = texture2D(matcapTexture, uv).rgb;
        gl_FragColor = vec4(color * vDepth, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      matcapTexture: regl.prop('matcapTexture'),
      headModel: regl.prop('headModel'),
      model: regl.prop('model'),
      normalHeadModel: regl.prop('normalHeadModel'),
      normalModel: regl.prop('normalModel'),
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
    primitive: 'triangle',
    cull: { enable: true }
  })
}

function createMesh () {
  let radius = 0.015
  // Create a box.
  const w = 0.25
  const h = 0.3
  const d = 0.05
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

  generateBothAntlers(mesh)

  quad.subdivide(mesh, 3)

  return mesh
  // Adjust nose shape.
  centerRing.forEach(p => {
    p[2] += 0.1
    if (p[1] < 0) {
      p[2] += 0.1
    }
  })
  shapeEyes(mesh)
  shapeMaskBack(mesh)
  refineEyes(mesh)
  shapeNose(mesh)

  prepareAntlerMount(mesh, mesh.cells[23], -1)
  createAntler(mesh, mesh.cells[23], radius, 1)

  prepareAntlerMount(mesh, mesh.cells[0])
  createAntler(mesh, mesh.cells[0], radius, -1)

  quad.subdivide(mesh, 2)
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

  const antlerPositions = quad.getNewGeometry(mesh, "positions", () => {
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

function shapeEyes (mesh) {
  ;[27, 19, 20, 28].forEach(i => {
    mesh.positions[i][0] *= 0.2
    mesh.positions[i][1] -= 0.07
  })

  // Make eyes not quite so large
  ;[33, 29].forEach(i => mesh.cells[i].forEach(pI => mesh.positions[pI][1] -= 0.03))
  ;[31, 27].forEach(i => mesh.cells[i].forEach(pI => mesh.positions[pI][1] += 0.03))
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

function refineEyes (mesh, cellIndex) {
  quad.subdivide(mesh, 1)
  ;[[48, true], [75, false]].forEach(([cellIndex, opposite]) => {
    const cell = mesh.cells[cellIndex]
    quad.insetLoop(mesh, cell, 0.05, opposite)

    const ring = quad.getNewGeometry(mesh, "positions", () => {
      quad.insetLoop(mesh, cell, 0.00, opposite)
      quad.insetLoop(mesh, cell, 0.05, opposite)
    })

    quad.getLoop(mesh, mesh.cells[146], 'cells')
      .reduce((a, b) => a.concat(b))
      .map(i => mesh.positions[i])
      .concat(ring)
      .filter(unique)
      .forEach(p => p[2] += 0.01)
  })
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

function extrudeHair (mesh) {
  // Adjust top rim sizing of the mask
  // Top row back
  mesh.positions[53][2] -= 0.028
  mesh.positions[51][2] -= 0.028
  mesh.positions[7][2] -= 0.015
  mesh.positions[37][2] -= 0.015

  mesh.positions[7][1] += 0.015
  mesh.positions[37][1] += 0.015

  // Bottom Row back
  mesh.positions[36][2] -= 0.03
  mesh.positions[51][2] -= 0.03
  mesh.positions[8][2] -= 0.03
  quad.computeNormals(mesh)

  quad.splitLoop(mesh, mesh.cells[10], 0.5, true)
  quad.splitLoop(mesh, mesh.cells[9], 0.5)
  quad.splitLoop(mesh, mesh.cells[13], 0.5)
  quad.splitLoop(mesh, mesh.cells[14], 0.5, true)

  // return
  // const cells = [0, 3, 36, 39, 20, 23].map(i => mesh.cells[i])
  const random = createRandom(11)
  const cells = quad
    .getLoop(mesh, mesh.cells[0], 'cells', true)
    .filter(unique)
    .filter(cell => (
      mesh.positions[cell[0]][1] +
      mesh.positions[cell[1]][1] +
      mesh.positions[cell[2]][1] +
      mesh.positions[cell[3]][1] > -0.4
    ))

  cells.forEach(cell => extrudeAndRotateCell(mesh, cell, random))
  cells.forEach(cell => quad.extrude(mesh, cell, 0.1, 0.005))
  cells.forEach(cell => extrudeAndRotateCell(mesh, cell, random))
  cells.forEach(cell => quad.extrude(mesh, cell, 0.25, 0.025))
  cells.forEach(cell => extrudeAndRotateCell(mesh, cell, random))
  cells.forEach(cell => quad.extrude(mesh, cell, 0.25, 0.025))
  cells.forEach(cell => extrudeAndRotateCell(mesh, cell, random))
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

function generateBothAntlers (mesh, radius) {
  const leftCell = mesh.cells[0]
  const rightCell = mesh.cells[11]
  const leftCenter = quad.computeCellCenter(mesh, leftCell)
  const rightCenter = quad.computeCellCenter(mesh, rightCell)

  const leftAntlers = quad.getNewGeometry(mesh, "positions", () => {
    squareCell(mesh, leftCell, 0.03, -1)
    quad.extrude(mesh, leftCell, 0.5, 0.01)
    quad.extrude(mesh, leftCell, 0.2, 0.001)
    createAntler(mesh, leftCell, radius, -1)
  })

  const rightAntlers = quad.getNewGeometry(mesh, "positions", () => {
    squareCell(mesh, rightCell, 0.03, -1)
    quad.extrude(mesh, rightCell, 0.5, 0.01)
    quad.extrude(mesh, rightCell, 0.2, 0.001)
    createAntler(mesh, rightCell, radius, 1)
  })

  sizeAntlers(mesh, leftAntlers, leftCenter, 1)
  sizeAntlers(mesh, rightAntlers, rightCenter, -1)
}

function sizeAntlers (mesh, positions, center, direction) {
  positions.forEach(position => {
    vec3.rotateZ(position, position, center, 0.3 * direction)
    vec3.scale(position, position, 2)
  })
}
