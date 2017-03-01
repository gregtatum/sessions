const lerp = require('lerp')
const quad = require('../common/quads')
const glsl = require('glslify')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const vec3 = require('gl-vec3')
const createRandom = require('@tatumcreative/random')
const TAU = 6.283185307179586
const origin = [0, 0, 0]
const RECEPTECAL_SIZE = 0.2
const RECEPTECAL_HEIGHT = 0.25
const BASE_OFFSET = -0.16

module.exports = function rayFlorets (regl) {
  const mesh = createMesh()
  const drawStem = createDrawStem(regl, mesh)
  return drawStem
}

function createMesh () {
  const mesh = quad.createBox(
    RECEPTECAL_SIZE,
    RECEPTECAL_SIZE * RECEPTECAL_HEIGHT,
    RECEPTECAL_SIZE
  )

  // Extrude down.
  quad.extrude(mesh, mesh.cells[1], 0.8, 0.025)
  quad.extrude(mesh, mesh.cells[1], 0.0, 0.05)
  quad.extrude(mesh, mesh.cells[1], 0.0, 0.05)
  quad.extrude(mesh, mesh.cells[1], 0.0, 0.05)

  // Extrude top inset.
  quad.extrude(mesh, mesh.cells[0], 0.5, -0.005)

  mesh.positions.forEach(p => {
    p[1] += BASE_OFFSET
  })

  return quad.subdivide(mesh, 2)
}

function createDrawStem (regl, mesh) {
  return regl({
    attributes: {
      position: mesh.positions,
      normal: mesh.normals,
    },
    uniforms: {
      hueShiftAmount: 0.3,
      edgeGlow: 0.3,
      brightness: 0.75,
      saturationShiftAmount: 0.3,
      lightnessShiftAmount: -0.05

    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
  })
}
