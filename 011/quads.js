const vec3 = require('gl-vec3')

/**
 *  b---bc---c
 *  |   |    |
 *  |   |    |
 *  a---ad---d
 */
function splitQuadVertical ({positions, cells}, targetCell, t = 0.5) {
  const [a, b, c, d] = targetCell
  const positionA = positions[a]
  const positionB = positions[b]
  const positionC = positions[c]
  const positionD = positions[d]
  const bcPosition = vec3.lerp([], positionB, positionC, t)
  const adPosition = vec3.lerp([], positionA, positionD, t)
  const bc = positions.length
  const ad = bc + 1
  positions[bc] = bcPosition
  positions[ad] = adPosition
  targetCell[2] = bc
  targetCell[3] = ad
  cells.push([ad, bc, c, d])
}

/**
 *  b---bc1  bc2---c
 *  |     |  |     |
 *  |     |  |     |
 *  a---ad1  ad2---d
 *  target
 */
function splitQuadVerticalDisjoint (quads, targetCell, t = 0.5) {
  const {positions, cells, normals} = quads
  const [a, b, c, d] = targetCell
  const bc1 = positions.length
  const ad1 = bc1 + 1
  const bc2 = bc1 + 2
  const ad2 = bc1 + 3

  // Add the positions
  const bcPosition = vec3.lerp([], positions[b], positions[c], t)
  const adPosition = vec3.lerp([], positions[a], positions[d], t)
  positions[bc1] = bcPosition
  positions[ad1] = adPosition
  positions[bc2] = bcPosition.slice()
  positions[ad2] = adPosition.slice()

  // Update the cells
  targetCell[2] = bc1
  targetCell[3] = ad1
  cells.push([ad2, bc2, c, d])

  // Normals - assume that disjoint splits all share the same normal.
  const normal = normals[a]
  normals[ad1] = normal.slice()
  normals[ad2] = normal.slice()
  normals[bc1] = normal.slice()
  normals[bc2] = normal.slice()
}

/**
 *  b--------c
 *  |        |
 *  ab------cd
 *  |        |
 *  a--------d
 */
function splitQuadHorizontal ({positions, cells}, targetCell, t = 0.5) {
  const [a, b, c, d] = targetCell
  const positionA = positions[a]
  const positionB = positions[b]
  const positionC = positions[c]
  const positionD = positions[d]
  const abPosition = vec3.lerp([], positionB, positionA, t)
  const cdPosition = vec3.lerp([], positionC, positionD, t)
  const ab = positions.length
  const cd = ab + 1
  positions[ab] = abPosition
  positions[cd] = cdPosition
  targetCell[1] = ab
  targetCell[2] = cd
  cells.push([ab, b, c, cd])
}

/**
 *  b--------c
 *  |        |
 *  ab1----cd1
 *  ab2----cd2
 *  | target |
 *  a--------d
 */
function splitQuadHorizontalDisjoint (quads, targetCell, t = 0.5) {
  const {positions, cells, normals} = quads
  const [a, b, c, d] = targetCell
  const ab1 = positions.length
  const cd1 = ab1 + 1
  const ab2 = ab1 + 2
  const cd2 = ab1 + 3

  // Positions
  const abPosition = vec3.lerp([], positions[a], positions[b], t)
  const cdPosition = vec3.lerp([], positions[d], positions[c], t)
  positions[ab1] = abPosition
  positions[cd1] = cdPosition
  positions[ab2] = abPosition.slice()
  positions[cd2] = cdPosition.slice()

  // Cells
  targetCell[0] = ab1
  targetCell[3] = cd1
  cells.push([a, ab2, cd2, d])

  // Normals - assume that disjoint splits all share the same normal.
  const normal = normals[a]
  normals[ab1] = normal.slice()
  normals[cd1] = normal.slice()
  normals[ab2] = normal.slice()
  normals[cd2] = normal.slice()
}

/**
 *  b----------c
 *  |\   q1   /|
 *  | \      / |
 *  |  f----g  |
 *  |q0| tQ |q2|
 *  |  e----h  |
 *  | /      \ |
 *  |/   q3   \|
 *  a----------d
 */
var insetQuad = (() => {
  var center = [0, 0, 0]
  return function({positions, cells}, targetCell, t = 0) {
    const [a, b, c, d] = targetCell
    const e = positions.length
    const f = e + 1
    const g = f + 1
    const h = g + 1
    const positionA = positions[a]
    const positionB = positions[b]
    const positionC = positions[c]
    const positionD = positions[d]

    // Update positions
    center[0] = (positionA[0] + positionB[0] + positionC[0] + positionD[0]) / 4
    center[1] = (positionA[1] + positionB[1] + positionC[1] + positionD[1]) / 4
    center[2] = (positionA[2] + positionB[2] + positionC[2] + positionD[2]) / 4
    positions.push(vec3.lerp([], positionA, center, t))
    positions.push(vec3.lerp([], positionB, center, t))
    positions.push(vec3.lerp([], positionC, center, t))
    positions.push(vec3.lerp([], positionD, center, t))

    // Update cells
    targetCell[0] = e
    targetCell[1] = f
    targetCell[2] = g
    targetCell[3] = h
    const q0 = [a, b, f, e]
    const q1 = [f, b, c, g]
    const q2 = [h, g, c, d]
    const q3 = [a, e, h, d]
    cells.push(q0)
    cells.push(q1)
    cells.push(q2)
    cells.push(q3)
    return [q0, q1, q2, q3, targetCell]
  }
})()

/**
 *      bT----------cT
 *  bL   \    qT    /   cR
 *  |\    \        /    /|
 *  | \    fT----gT    / |
 *  |  fL  fM----gM  gR  |
 *  |qL|   |  tC |    |qR|   tC = targetCell
 *  |  eL  eM----hM  hR  |
 *  | /    eB----hB    \ |
 *  |/    /        \    \|
 *  aL   /    qB    \   dR
 *      aB----------dB
 */
var insetQuadDisjoint = (() => {
  var center = [0, 0, 0]
  return function(quads, targetCell, t = 0) {
    const {positions, cells, normals} = quads
    const [a, b, c, d] = targetCell
    const positionA = positions[a]
    const positionB = positions[b]
    const positionC = positions[c]
    const positionD = positions[d]

    // Calculate inset positions
    center[0] = (positionA[0] + positionB[0] + positionC[0] + positionD[0]) / 4
    center[1] = (positionA[1] + positionB[1] + positionC[1] + positionD[1]) / 4
    center[2] = (positionA[2] + positionB[2] + positionC[2] + positionD[2]) / 4
    const positionE = vec3.lerp([], positionA, center, t)
    const positionF = vec3.lerp([], positionB, center, t)
    const positionG = vec3.lerp([], positionC, center, t)
    const positionH = vec3.lerp([], positionD, center, t)

    // Assign indices
    const offset = positions.length
    const aB = offset
    const aL = a
    const bL = b
    const bT = offset + 1
    const cT = offset + 2
    const cR = c
    const dR = d
    const dB = offset + 3
    const eM = offset + 4
    const eB = offset + 5
    const eL = offset + 6
    const fM = offset + 7
    const fL = offset + 8
    const fT = offset + 9
    const gM = offset + 10
    const gT = offset + 11
    const gR = offset + 12
    const hM = offset + 13
    const hR = offset + 14
    const hB = offset + 15

    // Update cells
    targetCell[0] = eM
    targetCell[1] = fM
    targetCell[2] = gM
    targetCell[3] = hM
    const qL = [aL, bL, fL, eL]
    const qT = [fT, bT, cT, gT]
    const qR = [hR, gR, cR, dR]
    const qB = [aB, eB, hB, dB]
    cells.push(qL)
    cells.push(qT)
    cells.push(qR)
    cells.push(qB)

    // Update positions
    positions[aB] = positionA.slice()
    positions[aL] = positionA
    positions[bL] = positionB
    positions[bT] = positionB.slice()
    positions[cT] = positionC.slice()
    positions[cR] = positionC
    positions[dR] = positionD
    positions[dB] = positionD.slice()
    positions[eM] = positionE
    positions[eB] = positionE.slice()
    positions[eL] = positionE.slice()
    positions[fM] = positionF
    positions[fL] = positionF.slice()
    positions[fT] = positionF.slice()
    positions[gM] = positionG
    positions[gT] = positionG.slice()
    positions[gR] = positionG.slice()
    positions[hM] = positionH
    positions[hR] = positionH.slice()
    positions[hB] = positionH.slice()

    // Normals - assume that disjoint quads all share the same normal.
    const normal = normals[a]
    normals[aB] = normal.slice()
    normals[aL] = normals[a]
    normals[bL] = normals[b]
    normals[bT] = normal.slice()
    normals[cT] = normal.slice()
    normals[cR] = normals[c]
    normals[dR] = normals[d]
    normals[dB] = normal.slice()
    normals[eM] = normal.slice()
    normals[eB] = normal.slice()
    normals[eL] = normal.slice()
    normals[fM] = normal.slice()
    normals[fL] = normal.slice()
    normals[fT] = normal.slice()
    normals[gM] = normal.slice()
    normals[gT] = normal.slice()
    normals[gR] = normal.slice()
    normals[hM] = normal.slice()
    normals[hR] = normal.slice()
    normals[hB] = normal.slice()

    return [qL, qT, qR, qB]
  }
})()

var extrudeQuadDisjoint = (() => {
  const toTranslate = []
  const translation = []
  const edgeA = []
  const edgeB = []
  return function (quads, targetCell, insetT = 0, extrude = 0) {
    const {positions, cells, normals} = quads
    const ring = insetQuadDisjoint(quads, targetCell, insetT)
    const [qL, qT, qR, qB] = ring

    // Enumerate which positions to translate
    toTranslate[0] = targetCell[0]
    toTranslate[1] = targetCell[1]
    toTranslate[2] = targetCell[2]
    toTranslate[3] = targetCell[3]

    toTranslate[4] = qL[2]
    toTranslate[5] = qL[3]

    toTranslate[6] = qT[0]
    toTranslate[7] = qT[3]

    toTranslate[8] = qR[0]
    toTranslate[9] = qR[1]

    toTranslate[10] = qB[1]
    toTranslate[11] = qB[2]

    // Assume that disjoint quads all share the same normal.
    const targetCellNormal = normals[targetCell[0]]
    vec3.scale(translation, targetCellNormal, extrude)

    for (let i = 0; i < toTranslate.length; i++) {
      const position = positions[toTranslate[i]]
      vec3.add(position, position, translation)
    }

    // Calculate the normals for the translated rings.
    for (let i = 0; i < ring.length; i++) {
      const cell = ring[i]
      const positionA = positions[cell[0]]
      const positionB = positions[cell[1]]
      const positionC = positions[cell[2]]
      const normal = normals[cell[0]]
      vec3.subtract(edgeA, positionB, positionA)
      vec3.subtract(edgeB, positionC, positionB)
      vec3.normalize(normal, vec3.cross(normal, edgeA, edgeB))
      vec3.copy(normals[cell[1]], normal)
      vec3.copy(normals[cell[2]], normal)
      vec3.copy(normals[cell[3]], normal)
    }
  }
})()

module.exports = {
  splitQuadVertical,
  splitQuadHorizontal,
  splitQuadVerticalDisjoint,
  splitQuadHorizontalDisjoint,
  insetQuad,
  insetQuadDisjoint,
  extrudeQuadDisjoint,
}
