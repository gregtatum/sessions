const glsl = require('glslify')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const quad = require('../common/quads')
const createRandom = require('@tatumcreative/random')

module.exports = function (regl) {
  const mesh = createGeometry()
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
      uniform vec3 cameraPosition;
      uniform mat3 normalModel, normalView;
      uniform mat4 model, projView;
      varying vec3 vNormal, vCameraVector;

      void main() {
        vec4 globalPosition = model * vec4(position, 1.0);
        vNormal = normalView * normalModel * normal;
        vCameraVector = normalView * (globalPosition.xyz - cameraPosition);
        gl_Position = projView * globalPosition;
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform sampler2D matcapTexture;
      varying vec3 vNormal, vCameraVector;

      void main() {
        vec2 uv = matcap(
          normalize(vCameraVector),
          normalize(vNormal)
        );
        vec3 color = texture2D(matcapTexture, uv).rgb;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      matcapTexture: regl.prop('matcapTexture'),
      model: regl.context('headModel'),
      normalModel: regl.context('headNormalModel')
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
    primitive: 'triangle',
    cull: { enable: true }
  })
}

function createGeometry () {
  // Create a box.
  const w = 0.2
  const h = 0.17
  const d = 0.2
  let mesh = quad.createBox(w, h, d)
  mesh.positions.forEach(p => {
    p[1] += 0.2
  })

  const NECK_INSET = 0.8
  const NECK_LENGTH = 0.02
  const SHOULDERS_INSET = -3
  const SHOULDERS_LENGTH = 0.02
  const BODY_INSET = 0.5
  const BODY_LENGTH = 0.05

  const bodyTip = mesh.cells[1]

  // neck
  quad.extrude(mesh, bodyTip, NECK_INSET, NECK_LENGTH)
  // shoulders
  quad.extrude(mesh, bodyTip, SHOULDERS_INSET, SHOULDERS_LENGTH)
  // body
  quad.extrude(mesh, bodyTip, BODY_INSET, BODY_LENGTH)
  // Do an initial subdivide.
  quad.subdivide(mesh, 1)

  const leftArm = mesh.cells[49]
  const rightArm = mesh.cells[42]
  const leftLeg = mesh.cells[58]
  const rightLeg = mesh.cells[65]

  shapeLimb(mesh, leftArm, {
    base: (p, c) => {
      vec3.rotateZ(p, p, c, 0.5)
    },
    thigh: (p, c) => {
      vec3.rotateZ(p, p, c, 1.0)
      vec3.rotateX(p, p, c, 0.5)
    },
    knee1: (p, c) => {
      vec3.rotateZ(p, p, c, 0.2)
      vec3.rotateX(p, p, c, -1.0)
    },
    knee2: (p, c) => {},
  })
  shapeLimb(mesh, rightArm, {
    base: (p, c) => {
      vec3.rotateZ(p, p, c, -0.5)
    },
    thigh: (p, c) => {
      vec3.rotateZ(p, p, c, -1.2)
      vec3.rotateX(p, p, c, 0.5)
    },
    knee1: (p, c) => {
      vec3.rotateZ(p, p, c, 0)
      vec3.rotateX(p, p, c, -1)
      vec3.rotateY(p, p, c, -1.5);
    },
    knee2: (p, c) => {
      vec3.rotateX(p, p, c, -1)
    }
  })
  shapeLimb(mesh, leftLeg, {
    base: (p, c) => {
      p[0] -= 0.01
      vec3.rotateZ(p, p, c, -0.5)
    },
    thigh: (p, c) => {
      vec3.rotateZ(p, p, c, -0.8)
    },
    knee1: () => {},
    knee2: (p, c) => {}
  })
  shapeLimb(mesh, rightLeg, {
    base: (p, c) => {
      p[0] += 0.02
      vec3.rotateZ(p, p, c, 0.5)
    },
    thigh: (p, c) => vec3.rotateZ(p, p, c, 0.8),
    knee1: () => {},
    knee2: (p, c) => {}
  })

  quad.subdivide(mesh, 2)
  return mesh
}

function applyLimbMorph (mesh, cell, morph) {
  const center = quad.getCenter(mesh, cell, [])
  cell.forEach(i => {
    morph(mesh.positions[i], center)
  })
}

function shapeLimb (mesh, cell, morphs) {
  applyLimbMorph(mesh, cell, morphs.base)
  quad.extrude(mesh, cell, 0.1, 0.01)
  applyLimbMorph(mesh, cell, morphs.thigh)
  quad.extrude(mesh, cell, 0.4, 0.03)
  applyLimbMorph(mesh, cell, morphs.knee1)
  quad.extrude(mesh, cell, 0.1, 0.005)
  applyLimbMorph(mesh, cell, morphs.knee2)
  quad.extrude(mesh, cell, 0.5, 0.03)
}
