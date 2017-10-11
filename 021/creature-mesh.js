const quad = require('../common/quads')
const { cos, sin } = Math
const lerp = require('lerp')
const simplex = new (require('simplex-noise'))()
const vec3 = require('gl-vec3')
module.exports = function createGeometry () {
  // Create a box.
  const size = 0.2
  const meshWidth = 0.5
  const mesh = quad.createBox(size * meshWidth, size, size * meshWidth)

  const config = {
    size,
    meshWidth,
    tentacleStartingHeight : -size * 0.45,
    tentacleExtrudeDistance : size * 0.6,
    tentacleInset : 0.9,
    twistDistance : 2,
  }

  quad.inset(mesh, mesh.cells[1], 0.4);
  quad.subdivide(mesh, 2)
  extrudeTentacles(mesh, config)
  distortHead(mesh, config)
  quad.subdivide(mesh, 1)
  twist(mesh, config)
  quad.computeNormals(mesh)

  return Object.assign(mesh, config)
}

function extrudeTentacles (mesh, config) {
  const {
    tentacleStartingHeight,
    tentacleInset,
    tentacleExtrudeDistance,
    size,
  } = config

  // Extrude out the tentacles.
  mesh.cells
    // Pick the lower bounds of the mesh to extrude.
    .filter(cell => averageCellHeight(mesh, cell) < tentacleStartingHeight)
    .forEach(cell => {
      const steps = 8
      cell.forEach(positionIndex => {
        const position = mesh.positions[positionIndex]
        // Smooth out the
        position[1] = lerp(position[1], tentacleStartingHeight, 0.5)
        position[1] += Math.random() * size * 0.02
      })
      for (let i = 0; i < steps; i++) {
        quad.extrude(
          mesh,
          cell,
          tentacleInset / steps,
          tentacleExtrudeDistance / steps
        )
      }
    })
}

function twist (mesh, config) {
  const { twistDistance, size } = config
  // Twist and shout!
  mesh.positions.forEach(position => {
    const [x, y, z] = position
    const theta = (y / size) * twistDistance
    position[0] = x * cos(theta) - z * sin(theta)
    position[2] = x * sin(theta) + z * cos(theta)
  })
}

function distortHead (mesh, config) {
  const {
    tentacleStartingHeight,
    size,
  } = config
  const fromCenter = []
  const lumpiness = 0.2
  const lumpinessScale = 20

  // Extrude out the tentacles.
  mesh.positions
    // Pick the lower bounds of the mesh to extrude.
    .filter(position => position[1] > tentacleStartingHeight)
    .forEach(position => {
      const noise = lerp(
        1.0,
        0.5 * (1 + simplex.noise3D(
          lumpinessScale * position[0],
          lumpinessScale * position[1],
          lumpinessScale * position[2]
        )),
        lumpiness
      )
      const distanceFromCenter = vec3.length(position)
      vec3.scale(fromCenter, position, 1 / distanceFromCenter)
      vec3.scale(position, fromCenter, distanceFromCenter * noise)
    })
}

function averageCellHeight (mesh, cell) {
  const positions = cell.map(i => mesh.positions[i])
  let height = 0
  positions.forEach(([x, y, z]) => height += y)
  return height / positions.length
}
