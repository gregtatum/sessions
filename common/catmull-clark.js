function ensureExists(item, message) {
  if (item === null) {
    throw new Error(
      message || 'Attempted to get a value assumed non-null, but it was null.'
    );
  }
  if (item === undefined) {
    throw new Error(
      message || 'Attempted to get a defined value, but it was undefined.'
    );
  }
  return item;
}

/**
 * This will insert a value into a list for a key. If that list doesn't exist yet,
 * it will create it.
 */
function addToMapSet(map, key, value) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

module.exports = function subdivide(mesh, divisions = 1) {
  for (let i = 0; i < divisions; i++) {
    Object.assign(mesh, subdivideImpl(mesh));
  }
}

function subdivideImpl(mesh) {
  // https://rosettacode.org/wiki/Catmull%E2%80%93Clark_subdivision_surface
  // https://people.eecs.berkeley.edu/~sequin/CS284/PAPERS/CatmullClark_SDSurf.pdf

  const { positions: points, cells: faces } = mesh;

  // There is probably some rigourous math I can apply here to see how many new points
  // are getting created, but for now I observed that 10 times the starting points
  // is adequate to not have conflicts for the hashing function.
  const getEdgeHashKey = getEdgeHashKeyFn(points.length * 10);
  const newPoints = points.slice();
  const newFaces = [];
  const facePointsStartIndex = points.length;
  const edgeHashToEdgePointIndex = new Map();
  const edgeHashToEdgeMidpoints = new Map();
  const pointIndexToNeighboringFacePoints = new Map();

  // For each face, add a face point.
  const facePoints = faces.map(face => {
    const a = points[face[0]];
    const b = points[face[1]];
    const c = points[face[2]];
    const d = points[face[3]];

    // Set each face point to be the average of all original points for the respective face.
    const position = [
      (a[0] + b[0] + c[0] + d[0]) * 0.25,
      (a[1] + b[1] + c[1] + d[1]) * 0.25,
      (a[2] + b[2] + c[2] + d[2]) * 0.25,
    ];
    newPoints.push(position);
    addToMapSet(pointIndexToNeighboringFacePoints, face[0], position);
    addToMapSet(pointIndexToNeighboringFacePoints, face[1], position);
    addToMapSet(pointIndexToNeighboringFacePoints, face[2], position);
    addToMapSet(pointIndexToNeighboringFacePoints, face[3], position);
    return position;
  });

  const { edges, pointToEdges, edgeFaces } = deriveEdges(faces, getEdgeHashKey);

  // Create the edge points.
  for (const [key, edge] of edges) {
    const positionA = points[edge[0]];
    const positionB = points[edge[1]];
    const faces = ensureExists(
      edgeFaces.get(key),
      'Could not find a face for the edge'
    );
    let count = 2;
    let sumX = positionA[0] + positionB[0];
    let sumY = positionA[1] + positionB[1];
    let sumZ = positionA[2] + positionB[2];

    if (
      // An edge is the border of a hole if it belongs to only one face. In this
      // case do not use the face border.
      faces.size > 1
    ) {
      // Set each edge point to be the average of the two neighbouring face points
      // and its two original endpoints.
      for (const faceIndex of faces) {
        const facePoint = ensureExists(
          facePoints[faceIndex],
          'Could not find the face point for a face'
        );
        sumX += facePoint[0];
        sumY += facePoint[1];
        sumZ += facePoint[2];
        count++;
      }
    }

    const edgePoint = [
      // Prettier.
      sumX / count,
      sumY / count,
      sumZ / count,
    ];
    const edgePointIndex = newPoints.length;
    newPoints.push(edgePoint);
    edgeHashToEdgePointIndex.set(key, edgePointIndex);
  }

  // For each face point, add an edge for every edge of the face, connecting the
  // face point to each edge point for the face.
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
    const face = faces[faceIndex];
    const fI = facePointsStartIndex + faceIndex;

    const [aI, bI, cI, dI] = face;

    const error = 'Could not look up an edge point based on the edge hash';
    const abI = ensureExists(
      edgeHashToEdgePointIndex.get(getEdgeHashKey(aI, bI)),
      error
    );
    const bcI = ensureExists(
      edgeHashToEdgePointIndex.get(getEdgeHashKey(bI, cI)),
      error
    );
    const cdI = ensureExists(
      edgeHashToEdgePointIndex.get(getEdgeHashKey(cI, dI)),
      error
    );
    const daI = ensureExists(
      edgeHashToEdgePointIndex.get(getEdgeHashKey(dI, aI)),
      error
    );

    // bI---bcI---cI
    // |           |
    // abI  fI   cdI
    // |           |
    // aI---adI---dI

    newFaces.push(
      [aI, abI, fI, daI],
      [abI, bI, bcI, fI],
      [fI, bcI, cI, cdI],
      [daI, fI, cdI, dI]
    );

    // Create the new cells here.
  }

  for (const [key, edge] of edges) {
    const pointA = newPoints[edge[0]];
    const pointB = newPoints[edge[1]];
    const midpoint = [
      (pointA[0] + pointB[0]) / 2,
      (pointA[1] + pointB[1]) / 2,
      (pointA[2] + pointB[2]) / 2,
    ];
    edgeHashToEdgeMidpoints.set(key, midpoint);
  }

  const finalPoints = newPoints.map(([x, y, z]) => [x, y, z]);

  // For each original point P
  for (let pointIndex = 0; pointIndex < facePointsStartIndex; pointIndex++) {
    // Take the average R of all n edge midpoints for (original) edges touching P.
    // where each edge midpoint is the average of its two endpoint vertices (not to be
    // confused with new "edge points" above). Move each original point to the point.
    const edges = ensureExists(
      pointToEdges.get(pointIndex),
      'Unable to look up the edges for a point'
    );
    const edgePoints = [];
    const edgeMidpoints = [];
    for (const edge of edges) {
      const edgeHashKey = getEdgeHashKey(edge[0], edge[1]);
      const edgePointIndex = ensureExists(
        edgeHashToEdgePointIndex.get(edgeHashKey),
        'Unable to look up the edge point index from an edge hash'
      );
      edgeMidpoints.push(
        ensureExists(
          edgeHashToEdgeMidpoints.get(edgeHashKey),
          'Could not look up the edge midpoint from the edge hash key'
        )
      );
      edgePoints.push(newPoints[edgePointIndex]);
    }

    const facePoints = ensureExists(
      pointIndexToNeighboringFacePoints.get(pointIndex),
      'Could not look up the face points for a given point index.'
    );

    if (edgePoints.length !== facePoints.size) {
      // For the vertex points that are on the border of a hole, the new coordinates
      // are calculated as follows:
      //   1. In all the edges the point belongs to, only take in account the middles
      //      of the edges that are on the border of the hole
      //   2. Calculate the average between these points (on the hole boundary) and
      //      the old coordinates (also on the hole boundary).
      const finalPoint = finalPoints[pointIndex];
      let holeyEdgeCount = 0;
      for (const edge of edges) {
        const edgeHashKey = getEdgeHashKey(edge[0], edge[1]);
        const faces = ensureExists(
          edgeFaces.get(edgeHashKey),
          'Could not get the faces from an edge hash key'
        );
        if (faces.size === 1) {
          // This edge is next to a hole.
          const midpoint = ensureExists(
            edgeHashToEdgeMidpoints.get(edgeHashKey),
            'Could not look up the edge midpoint from the edge hash key'
          );
          finalPoint[0] += midpoint[0];
          finalPoint[1] += midpoint[1];
          finalPoint[2] += midpoint[2];
          holeyEdgeCount++;
        }
      }
      finalPoint[0] /= holeyEdgeCount + 1;
      finalPoint[1] /= holeyEdgeCount + 1;
      finalPoint[2] /= holeyEdgeCount + 1;

      continue;
    }

    // Take the average R of all n edge midpoints for (original) edges touching P
    let rX = 0;
    let rY = 0;
    let rZ = 0;
    for (const midePoints of edgeMidpoints) {
      rX += midePoints[0];
      rY += midePoints[1];
      rZ += midePoints[2];
    }
    rX /= edgeMidpoints.length;
    rY /= edgeMidpoints.length;
    rZ /= edgeMidpoints.length;

    // Take the average F of all n (recently created) face points for faces touching P.
    let fX = 0;
    let fY = 0;
    let fZ = 0;
    for (const facePoint of facePoints) {
      fX += facePoint[0];
      fY += facePoint[1];
      fZ += facePoint[2];
    }
    fX /= facePoints.size;
    fY /= facePoints.size;
    fZ /= facePoints.size;

    // Apply the formula:
    // ( F + 2 * R + (n - 3) * P ) / n

    // n is the valence. The valence of a point is simply the number of edges that
    // connect to that point
    // http://www.rorydriscoll.com/2008/08/01/catmull-clark-subdivision-the-basics/
    const n = edgePoints.length;

    const [pX, pY, pZ] = newPoints[pointIndex];
    const p = finalPoints[pointIndex];
    p[0] = (fX + 2 * rX + (n - 3) * pX) / n;
    p[1] = (fY + 2 * rY + (n - 3) * pY) / n;
    p[2] = (fZ + 2 * rZ + (n - 3) * pZ) / n;
  }

  // Connect each new vertex point to the new edge points of all original edges incident
  // on the original vertex.

  const edgePoints = [];
  for (const [, pointIndex] of edgeHashToEdgePointIndex) {
    edgePoints.push(newPoints[pointIndex]);
  }

  return { cells: newFaces, positions: finalPoints };
}

/**
 * You can't have a Map that uses two keys, so this function creates a hash that will
 * ensure that it is unique for every combination of indexes.
 */
function getEdgeHashKeyFn(positionLength) {
  return (a, b) => {
    if (a > b) {
      // Ensure a consistent ordering for the indexes.
      const _a = a;
      a = b;
      b = _a;
    }
    return a + b * positionLength;
  };
}

function deriveEdges(faces, getEdgeHashKey) {
  const edges = new Map();
  const edgeFaces = new Map();
  const pointToEdges = new Map();

  // Compute the edges.
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
    const face = faces[faceIndex];
    const [a, b, c, d] = face;
    const abKey = getEdgeHashKey(a, b);
    const bcKey = getEdgeHashKey(b, c);
    const cdKey = getEdgeHashKey(c, d);
    const daKey = getEdgeHashKey(d, a);

    const abEdge = edges.get(abKey) || [a, b];
    const bcEdge = edges.get(bcKey) || [b, c];
    const cdEdge = edges.get(cdKey) || [c, d];
    const daEdge = edges.get(daKey) || [d, a];

    addToMapSet(pointToEdges, a, abEdge);
    addToMapSet(pointToEdges, a, daEdge);
    addToMapSet(pointToEdges, b, abEdge);
    addToMapSet(pointToEdges, b, bcEdge);
    addToMapSet(pointToEdges, c, bcEdge);
    addToMapSet(pointToEdges, c, cdEdge);
    addToMapSet(pointToEdges, d, cdEdge);
    addToMapSet(pointToEdges, d, daEdge);

    // Remember the edge for the key.
    edges.set(abKey, abEdge);
    edges.set(bcKey, bcEdge);
    edges.set(cdKey, cdEdge);
    edges.set(daKey, daEdge);

    // Associate the face to the edge.
    addToMapSet(edgeFaces, abKey, faceIndex);
    addToMapSet(edgeFaces, bcKey, faceIndex);
    addToMapSet(edgeFaces, cdKey, faceIndex);
    addToMapSet(edgeFaces, daKey, faceIndex);
  }

  return {
    edges,
    edgeFaces,
    pointToEdges,
  };
}
