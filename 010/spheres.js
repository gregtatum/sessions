const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
const glsl = require('glslify')
const createIcosphere = require('icosphere')
const normals = require('angle-normals')
const origin = [0, 0, 0]
const MAX_DEPTH = 4
const CHILD_NODES = 5
const TAU = 6.283185307179586
const BASE_CENTER = [0.1, 0, 0]
const BASE_SCALE = [0.05, 0.05, 0.05]
const CHILD_DISTANCE = 4
const CHILD_SCALE = 0.4

module.exports = function (regl) {
  const setupSphereShader = createSphereShader(regl)

  const drawSphereShort = createDrawCall(regl, createIcosphere(0))
  const drawSphereTall = createDrawCall(regl, createIcosphere(1))
  const drawSphereGrande = createDrawCall(regl, createIcosphere(2))
  const drawSphereVenti = createDrawCall(regl, createIcosphere(3))

  const rootNode = createNodes(CHILD_NODES, MAX_DEPTH)
  const props = flattenNodes(rootNode)

  const propsShort = props.filter(prop => prop.depth < MAX_DEPTH - 2)
  const propsTall = props.filter(prop => prop.depth < MAX_DEPTH - 1)
  const propsGrande = props.filter(prop => prop.depth === MAX_DEPTH - 1)
  const propsVenti = props.filter(prop => prop.depth === MAX_DEPTH)

  const drawGeometry = () => {
    drawSphereShort(propsShort)
    drawSphereTall(propsTall)
    drawSphereGrande(propsGrande)
    drawSphereVenti(propsVenti)
  }

  return (time) => {
    updateRootNode(rootNode, time)
    updateSphereTree(rootNode, time)
    setupSphereShader(drawGeometry)
  }
}

function createNodes (n, depth, branch) {
  return {
    props: { center: [0, 0, 0], scale: BASE_SCALE.slice(), depth },
    children: depth > 0
      ? Array.from({length: n}, i => createNodes(n, depth - 1))
      : null
  }
}

function flattenNodes (node, result = []) {
  result.push(node.props)
  if (node.children) {
    node.children.forEach(node => flattenNodes(node, result))
  }
  return result
}

function updateSphereTree (node, time, branch = 0, parentCenter, parentScale) {
  const {
    props: {center, scale},
    children
  } = node

  if (parentCenter) {
    vec3.copy(scale, parentScale)
    vec3.scale(scale, scale, CHILD_SCALE)
    vec3.copy(center, parentCenter)
    center[0] += parentScale[0] * CHILD_DISTANCE * (2.0 + Math.sin(time))
    vec3.rotateY(center, center, parentCenter, 0.01 * time / scale[0] + TAU * branch / CHILD_NODES)
    vec3.rotateX(center, center, parentCenter, 0.003 * time / scale[0] + TAU * branch / CHILD_NODES)
  }

  if (children) {
    for (let i = 0; i < children.length; i++) {
      updateSphereTree(children[i], time, i, center, scale)
    }
  }
}

function createSphereShader (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      #pragma glslify: rotateX = require(../common/glsl/rotateX)

      attribute vec3 position, normal;
      uniform mat4 model, view, projection;
      uniform vec3 cameraPosition;
      uniform float fov, aspectRatio, time;
      varying vec3 vPosition, vReflect, vColor;
      varying vec2 vUv;

      ${lights(i => `uniform vec3 light${i};`)}
      ${lights(i => `uniform vec3 lightColor${i};`)}

      void main() {
        vPosition = position;
        vec3 worldPosition = (model * vec4(position, 1.0)).xyz;

        float thetaX = (
          0.05 * sin(time + worldPosition.y * 300.0) +
          0.03 * sin(time * 3.0 + worldPosition.y * 500.0)
        );
        vec3 normal2 = rotateX(normal, thetaX);

        // vec3 cameraToSurface = normalize(worldPosition - cameraPosition);
        // Not "correct" but looks nicer.
        vec3 cameraToSurface = normalize(position - cameraPosition);
        vReflect = cameraToSurface - 2.0 * dot(cameraToSurface, normal2) * normal2;

        vec3 baseColor = vec3(1.0);
        vColor = ${lights(i => (
          `baseColor * lightColor${i} * max(0.0, dot(light${i}, normal2))`
        ), ' + ')};

        gl_Position = projection * view * model * vec4(position, 0.5);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: computeBackground = require(./background)

      varying vec3 vPosition, vReflect, vColor;
      uniform float time;

      #define PI ${Math.PI}

      void main () {
        // vec3 direction = normalize(vReflect);
        // Save on a normalization step.
        vec3 direction = vReflect;
        vec3 reflectiveColor = computeBackground(direction, time).xyz;
        vec3 color = (
          0.5 * reflectiveColor +
          0.5 * vColor
        );
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      fov: regl.context('fov'),
      aspectRatio: ({viewportHeight, viewportWidth}) => viewportWidth / viewportHeight
    },
    cull: {
      enable: true,
      face: 'back'
    }
  })
}

function createDrawCall (regl, sphere) {
  return regl({
    attributes: {
      position: sphere.positions,
      normal: normals(sphere.cells, sphere.positions)
    },
    uniforms: {
      model: (_, {scale, center}) => {
        return mat4.scale([], mat4.translate([], mat4.identity([]), center), scale)
      }
    },
    elements: sphere.cells
  })
}

function updateRootNode (rootNode, time) {
  const {center} = rootNode.props
  vec3.copy(center, BASE_CENTER)
  vec3.rotateY(center, center, origin, 1 * time)
  center[1] = 0.1 * Math.sin(time)
}

function lights (fn, text = '\n') {
  const array = Array.from({length: 2}).map((n, i) => i)
  return array.map(fn).join(text)
}
