const glsl = require('glslify')

module.exports = function createDeferredRendering (regl) {
  const albedoTexture = regl.texture({type: 'float'});
  const normalTexture = regl.texture({type: 'float'});
  const positionTexture = regl.texture({type: 'float'});

  // Note, everything is in view space.
  const geometryBuffers = regl.framebuffer({
    color: [
      albedoTexture,
      normalTexture,
      positionTexture,
    ],
    depth: true
  })
  const drawToGeometryBuffers = regl({
    vert: glsl`
      precision mediump float;

      attribute vec3 position;
      attribute vec3 normal;

      uniform mat3 normalView;
      uniform mat4 projection, view, model;

      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        // Transform everything into view space.
        vec4 position = view * model * vec4(position, 1);
        vNormal = normalView * normal;
        vPosition = position.xyz;

        // The final calculation applies projection as well.
        gl_Position = projection * position;
      }
    `,
    frag: glsl`
      #extension GL_EXT_draw_buffers : require
      precision mediump float;

      varying vec3 vNormal;
      varying vec3 vPosition;

      void main () {
        vec3 albedo = vec3(0.8, 0.0, 0.2);
        gl_FragData[0] = vec4(albedo, 1.0);
        gl_FragData[1] = vec4(vNormal, 0.0);
        gl_FragData[2] = vec4(vPosition, 0.0);
      }
    `,
    framebuffer: geometryBuffers,
  })

  const withGeometryBuffers = regl({
    vert: glsl`
      precision mediump float;
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = 0.5 * (position + 1.0);
        gl_Position = vec4(position, 0, 1);
    }`,
    attributes: {
      // Create a full-screen triangle.
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      albedoTexture,
      normalTexture,
      positionTexture,
    },
    depth: { enable: false },
    count: 3
  })

  return { geometryBuffers, drawToGeometryBuffers, withGeometryBuffers }
}
