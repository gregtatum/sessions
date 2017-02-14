const lerp = require('lerp')
const quad = require('../common/quads')
const glsl = require('glslify')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const vec3 = require('gl-vec3')
const createRandom = require('@tatumcreative/random')
const TAU = 6.283185307179586
const origin = [0, 0, 0]

const FLORET_W = 0.5
const FLORET_H = 0.015
const FLORET_D = 0.07
const FLORET_COUNT = 25
// const FLORET_COUNT = 0
const FLORET_ROTATE_X = TAU * 0.0
const FLORET_ROTATE_Z = TAU * 0
const FLORET_TAPER = 0.4
const FLORET_BASE_UP = 0.03
const FLORET_CURL_IN = 0.6
const SPIRAL_ROTATE = TAU / FLORET_COUNT
const SPIRAL_JITTER = 0.15
const SPIRAL_UP = 0.00025
const SPIRAL_SIZE = 0.995
const BASE_OFFSET = -0.16
const JITTER_W = 0.04
const JITTER_H = 0.0
const JITTER_D = 0.1
const JITTER_UP = 0.02

module.exports = function rayFlorets (regl) {
  const mesh = createMesh()
  const drawRayFlorets = createDrawRayFlorets(regl, mesh)
  return drawRayFlorets
}

function createMesh () {

  const mesh = quad.createBox(FLORET_W, FLORET_H, FLORET_D)
  mesh.positions.forEach(p => {
    p[0] += FLORET_W / 2
  })

  quad.splitLoop(mesh, mesh.cells[0], 0.75)
  quad.subdivide(mesh, 1)

  // Bend up the floret at the base for a snugger fit.
  mesh.positions.forEach(p => {
    const lengthSq = vec3.squaredLength(p)
    if (lengthSq < FLORET_W * 0.1 && lengthSq > FLORET_W * 0.025) {
      p[1] += FLORET_BASE_UP
    }
  })

  quad.subdivide(mesh, 1)

  // Setup some base transform for the first petal.
  mesh.positions.forEach(p => {
    const unitW = p[0] * (1 / FLORET_W)
    p[2] *= lerp(FLORET_TAPER, 1, unitW)
    vec3.rotateX(p, p, origin, FLORET_ROTATE_X)
    // vec3.rotateZ(p, p, origin, FLORET_ROTATE_Z)
  })

  spiralPetal(mesh, mesh.cells.slice(), createRandom(9))

  mesh.positions.forEach(p => {
    p[1] += BASE_OFFSET + vec3.squaredLength(p) * FLORET_CURL_IN
  })

  quad.computeNormals(mesh)

  return mesh
}

function spiralPetal (mesh, baseCells, random) {
  for (let i = 0; i < FLORET_COUNT; i++) {
    const spiralJitter = random() * SPIRAL_JITTER
    const jitterW = random(-JITTER_W, JITTER_W)
    const jitterH = random(-JITTER_H, JITTER_H)
    const jitterD = random(-JITTER_D, JITTER_D)
    const jitterUp = random(-JITTER_UP, JITTER_UP)

    baseCells = quad.getNewGeometry(mesh, "cells", () => {
      const positions = quad.getNewGeometry(mesh, "positions", () => {
        quad.cloneCells(mesh, baseCells)
      })
      positions.forEach(p => {
        p[0] *= 1 + jitterW
        p[1] *= 1 + jitterH
        p[2] *= 1 + jitterD
        p[1] += jitterUp * (vec3.length(p) / FLORET_W)

        vec3.rotateY(p, p, origin, SPIRAL_ROTATE + spiralJitter)
      })
    })
  }
}

function createDrawRayFlorets (regl, mesh) {
  return regl({
    attributes: {
      position: mesh.positions,
      normal: mesh.normals,
    },
    uniforms: {
      hueShiftAmount: 0.0,
      edgeGlow: 0.3,
      brightness: 1.0,
      saturationShiftAmount: 0.6,
      lightnessShiftAmount: -0.05
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
  })
}
