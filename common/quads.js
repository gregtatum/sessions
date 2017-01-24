const vec3 = require('gl-vec3')

/**
 *  b---bc---c
 *  |   |    |
 *  |   |    |
 *  a---ad---d
 */
function splitVertical ({positions, cells}, targetCell, t = 0.5) {
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
function splitVerticalDisjoint (quads, targetCell, t = 0.5) {
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
function splitHorizontalDisjoint (quads, targetCell, t = 0.5) {
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
var inset = (() => {
  var center = [0, 0, 0]
  return function (quads, targetCell, t = 0) {
    const {positions, cells, normals} = quads
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
    normals.push(normals[a].slice())
    normals.push(normals[b].slice())
    normals.push(normals[c].slice())
    normals.push(normals[d].slice())

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

var extrude = (() => {
  const toTranslate = []
  const translation = []
  const targetCellNormal = []
  return function (quads, targetCell, insetT = 0, extrude = 0) {
    const {positions, normals} = quads
    const ring = inset(quads, targetCell, insetT)
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

    getCellNormal(quads, targetCell, targetCellNormal)
    vec3.scale(translation, targetCellNormal, extrude)

    for (let i = 0; i < toTranslate.length; i++) {
      const position = positions[toTranslate[i]]
      vec3.add(position, position, translation)
    }

    // Update all of the affected normals by averaging a position's neighboring
    // cell's normals. This will create some intermediate allocations, that will
    // then be GCed.
    const normalCache = new Map()
    normalCache.set(targetCell, targetCellNormal)
    const [a, b, c, d] = targetCell
    const e = positions.length - 4
    const f = positions.length - 3
    const g = positions.length - 2
    const h = positions.length - 1
    averageNormalForPosition(quads, a, normals[a], normalCache)
    averageNormalForPosition(quads, b, normals[b], normalCache)
    averageNormalForPosition(quads, c, normals[c], normalCache)
    averageNormalForPosition(quads, d, normals[d], normalCache)
    averageNormalForPosition(quads, e, normals[e], normalCache)
    averageNormalForPosition(quads, f, normals[f], normalCache)
    averageNormalForPosition(quads, g, normals[g], normalCache)
    averageNormalForPosition(quads, h, normals[h], normalCache)
  }
})()

function calculatePositionIndexToCells (quads) {
  const toCells = {}
  for (let i = 0; i < quads.cells.length; i++) {
    const cell = quads.cells[i]
    for (let j = 0; j < cell.length; j++) {
      const index = cell[j]
      let arr = toCells[index]
      if (!arr) {
        arr = []
        toCells[index] = arr
      }
      arr.push(cell)
    }
  }
  return toCells
}

var averageNormalForPosition = (() => {
  const cellsCache = []

  return function averageNormalForPosition (quads, positionIndex, target, normalCache, positionIndexToCells) {
    let cells
    if (positionIndexToCells) {
      cells = positionIndexToCells[positionIndex]
    } else {
      cells = cellsFromPositionIndex(quads, positionIndex, cellsCache)
    }
    vec3.set(target, 0, 0, 0)

    // Add neighboring cells' normals
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      let normal
      if (normalCache) {
        normal = normalCache.get(cell)
      }
      if (!normal) {
        normal = getCellNormal(quads, cell, [])
        if (normalCache) {
          normalCache.set(normal)
        }
      }
      vec3.add(target, target, normal)
    }
    vec3.normalize(target, target)

    // Clean out the cellsCache.
    while (cellsCache.length) {
      cellsCache.pop()
    }
    return target
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
var insetDisjoint = (() => {
  var center = [0, 0, 0]
  return function (quads, targetCell, t = 0) {
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

var extrudeDisjoint = (() => {
  const toTranslate = []
  const translation = []
  return function (quads, targetCell, insetT = 0, extrude = 0) {
    const {positions, normals} = quads
    const ring = insetDisjoint(quads, targetCell, insetT)
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
      updateNormals(quads, ring[i])
    }
  }
})()

function getCenter (quads, cell, target = []) {
  const a = quads.positions[cell[0]]
  const b = quads.positions[cell[1]]
  const c = quads.positions[cell[2]]
  const d = quads.positions[cell[3]]
  target[0] = (a[0] + b[0] + c[0] + d[0]) * 0.25
  target[1] = (a[1] + b[1] + c[1] + d[1]) * 0.25
  target[2] = (a[2] + b[2] + c[2] + d[2]) * 0.25
  return target
}

function clone (quads, cell) {
  const index = quads.positions.length
  const clonedCell = [index, index + 1, index + 2, index + 3]
  quads.cells.push(clonedCell)
  quads.positions.push(quads.positions[cell[0]].slice())
  quads.positions.push(quads.positions[cell[1]].slice())
  quads.positions.push(quads.positions[cell[2]].slice())
  quads.positions.push(quads.positions[cell[3]].slice())
  quads.normals.push(quads.normals[cell[0]].slice())
  quads.normals.push(quads.normals[cell[1]].slice())
  quads.normals.push(quads.normals[cell[2]].slice())
  quads.normals.push(quads.normals[cell[3]].slice())
  return clonedCell
}

function updateNormals (quads, cell) {
  let normal = quads.normals[cell[0]]
  getCellNormal(quads, cell, normal)
  vec3.copy(quads.normals[cell[1]], normal)
  vec3.copy(quads.normals[cell[2]], normal)
  vec3.copy(quads.normals[cell[3]], normal)
}

var getCellNormal = (() => {
  const edgeA = []
  const edgeB = []

  return function getCellNormal (quads, cell, target) {
    const positionA = quads.positions[cell[0]]
    const positionB = quads.positions[cell[1]]
    const positionC = quads.positions[cell[2]]
    vec3.subtract(edgeA, positionB, positionA)
    vec3.subtract(edgeB, positionC, positionB)
    vec3.normalize(target, vec3.cross(target, edgeA, edgeB))
    return target
  }
})()

function cellsFromPositionIndex (quads, index, target = []) {
  for (let i = 0; i < quads.cells.length; i++) {
    const cell = quads.cells[i]
    if (cell.indexOf(index) >= 0) {
      target.push(cell)
    }
  }
  return target
}

function flip (quads, cell) {
  const [a, b, c, d] = cell
  cell.reverse()
  const nA = quads.normals[a]
  const nB = quads.normals[b]
  const nC = quads.normals[c]
  const nD = quads.normals[d]
  vec3.scale(nA, nA, -1)
  vec3.scale(nB, nB, -1)
  vec3.scale(nC, nC, -1)
  vec3.scale(nD, nD, -1)
  return cell
}

function createQuad (options, quads = {}) {
  if (!quads.positions) {
    quads.positions = []
  }
  if (!quads.normals) {
    quads.normals = []
  }
  if (!quads.cells) {
    quads.cells = []
  }
  const index = quads.positions.length
  let direction
  const cell = [
    index,
    index + 1,
    index + 2,
    index + 3
  ]
  quads.cells.push(cell)
  if (options.positions) {
    quads.positions.push(options.positions[0])
    quads.positions.push(options.positions[1])
    quads.positions.push(options.positions[2])
    quads.positions.push(options.positions[3])
  } else {
    let w, h
    if (options.w && options.h) {
      w = options.w / 2
      h = options.h / 2
    } else {
      w = 0.5
      h = 0.5
    }
    const facing = options.facing || 'y+'
    const axis = facing[0]
    direction = facing[1]
    switch (axis) {
      case 'x':
        quads.positions.push([h, -w, -w])
        quads.positions.push([h, w, -w])
        quads.positions.push([h, w, w])
        quads.positions.push([h, -w, w])
        break
      case 'y':
        quads.positions.push([-w, h, -w])
        quads.positions.push([-w, h, w])
        quads.positions.push([w, h, w])
        quads.positions.push([w, h, -w])
        break
      case 'z':
        quads.positions.push([-w, -w, h])
        quads.positions.push([-w, w, h])
        quads.positions.push([w, w, h])
        quads.positions.push([w, -w, h])
        break
    }
  }

  const normal = getCellNormal(quads, cell, [])
  quads.normals.push(normal)
  quads.normals.push(normal.slice())
  quads.normals.push(normal.slice())
  quads.normals.push(normal.slice())

  if (direction === '-') {
    flip(quads, cell)
  }

  return {quads, cell}
}

function createBoxDisjoint (x = 1, y = 1, z = 1, optionalQuads) {
  const {quads, cell} = createQuad({w: x, h: z}, optionalQuads)
  quads.positions.forEach(position => {
    position[1] -= y
  })
  clone(quads, cell)
  flip(quads, quads.cells[1])
  extrudeDisjoint(quads, cell, 0, y)
  return quads
}

function createBox (x, y, z, optionalQuads) {
  return mergePositions(createBoxDisjoint(x, y, z, optionalQuads))
}

function mergePositions (quads) {
  const {positions, normals, cells} = quads
  // Go through each position.
  for (let aIndex = 0; aIndex < positions.length; aIndex++) {
    const a = positions[aIndex]

    // Compare this position to the rest of the position.
    for (let bIndex = aIndex + 1; bIndex < positions.length; bIndex++) {
      const b = positions[bIndex]

      // If the positions match, then remove "a" from positions.
      if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) {
        // Update the cells to point to the bIndex.
        for (let k = 0; k < cells.length; k++) {
          const cell = cells[k]
          for (let l = 0; l < cell.length; l++) {
            const index = cell[l]
            if (index === aIndex) {
              cell[l] = bIndex - 1
            } else if (index > aIndex) {
              cell[l]--
            }
          }
        }

        // Remove the position and continue
        positions.splice(aIndex, 1)
        normals.splice(aIndex, 1)
        aIndex--
        break
      }
    }
  }

  const normalCache = new Map()
  for (let i = 0; i < positions.length; i++) {
    averageNormalForPosition(quads, i, normals[i], normalCache)
  }
  return quads
}

function elementsFromQuads (regl, quads, drawMode = 'triangles', ArrayType = Uint16Array) {
  const countPerCell = drawMode === 'lines' ? 8 : 6
  const elements = new ArrayType(quads.cells.length * countPerCell)

  if (drawMode === 'lines') {
    // lines
    for (let i = 0; i < quads.cells.length; i++) {
      const [a, b, c, d] = quads.cells[i]
      const offset = i * countPerCell
      // Lines
      elements[offset + 0] = a
      elements[offset + 1] = b

      elements[offset + 2] = b
      elements[offset + 3] = c

      elements[offset + 4] = c
      elements[offset + 5] = d

      elements[offset + 6] = d
      elements[offset + 7] = a
    }
  } else {
    for (let i = 0; i < quads.cells.length; i++) {
      const offset = i * countPerCell
      const [a, b, c, d] = quads.cells[i]
      // Triangle:
      elements[offset + 0] = a
      elements[offset + 1] = b
      elements[offset + 2] = c

      elements[offset + 3] = c
      elements[offset + 4] = d
      elements[offset + 5] = a
    }
  }
  return elements
}

function computeNormals (quads) {
  if (!quads.normals) {
    quads.normals = []
  }
  const normalCache = new Map()
  const positionIndexToCells = calculatePositionIndexToCells(quads)
  for (let i = 0; i < quads.positions.length; i++) {
    let normal = quads.normals[i]
    if (!normal) {
      normal = []
      quads.normals[i] = normal
    }
    averageNormalForPosition(quads, i, normal, normalCache, positionIndexToCells)
  }
  return quads
}

module.exports = {
  splitVertical,
  splitQuadHorizontal,
  splitVerticalDisjoint,
  splitHorizontalDisjoint,
  inset,
  extrude,
  insetDisjoint,
  extrudeDisjoint,
  getCenter,
  getCellNormal,
  updateNormals,
  cellsFromPositionIndex,
  averageNormalForPosition,
  clone,
  flip,
  createQuad,
  createBoxDisjoint,
  createBox,
  mergePositions,
  elementsFromQuads,
  computeNormals
}
