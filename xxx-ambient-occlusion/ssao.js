const glsl = require('glslify')
const vec3 = require('gl-vec3')
const lerp = require('lerp')

module.exports = function createSSAO(regl, config = {}) {
  config = Object.assign({
    noiseWidth: 4,
    kernelCount: 33,
    radius: 0.4,
    bias: 0.025,
    // The following values are computed based on the kernel size.
    kernelWidth: 0,
    kernelSqSize: 0,
  }, config);

  {
    // Update the
    const rawWidth = Math.pow(config.kernelCount, 0.5);
    let width = 2;
    while (width < rawWidth) {
      width *= width;
    }
    config.kernelWidth = width;
    config.kernelSqSize = width * width;
  }

  const noiseTexture = createNoiseTetxure(regl, config);
  const kernelTexture = createKernelTexture(regl, config);

  const drawSSAO = regl({
    frag: glsl`
      precision mediump float;
      uniform sampler2D albedoTexture, normalTexture, worldPositionTexture,
                        positionTexture, noiseTexture, kernelTexture;
      uniform vec2 noiseScale;
      uniform vec3 samples[64];
      uniform mat4 projection;
      uniform float radius, bias;
      varying vec2 vUv;

      const float kernelCount = ${config.kernelSqSize}.0;
      const float kernelWidth = ${config.kernelWidth}.0;

      void main() {
        // Look up values from the gbuffer
        vec3 albedo = texture2D(albedoTexture, vUv).xyz;
        vec3 normal = normalize(texture2D(normalTexture, vUv).xyz);
        vec3 position = texture2D(positionTexture, vUv).xyz;

        vec3 randomVec = texture2D(noiseTexture, vUv * noiseScale).xyz;
        vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
        vec3 bitangent = cross(normal, tangent);
        mat3 tbnMatrix = mat3(tangent, bitangent, normal);

        // Compute the occlusion.
        float occlusion = 0.0;
        for (float i = 0.0; i < kernelCount; i += 1.0) {
          // Compute the coordinate into the kernel texture.
          float remainder = mod(i, kernelWidth);
          vec2 coordinate = vec2(
            remainder / kernelWidth,
            ((i - remainder) / kernelWidth)
          );

          // Look up the sample in the coordinate.
          vec3 sample = position +
            tbnMatrix * texture2D(kernelTexture, coordinate).xyz * radius;

          vec4 offset = projection * vec4(sample, 1.0);
          offset.xyz /= offset.w;
          offset.xyz = offset.xyz * 0.5 + 0.5;

          float sampleDepth = texture2D(positionTexture, offset.xy).z;

          // Compute a range check so occlusion doesn't happen on surfaces beyond
          // the range.
          float rangeCheck = smoothstep(0.0, 1.0, radius / abs(position.z - sampleDepth));

          // Accumulate the occlusion.
          occlusion += (sampleDepth >= sample.z + bias ? 1.0 : 0.0) * rangeCheck;
        }
        // Normalize the occlusion value by inverting it and taking into account
        // the kernel count.
        occlusion = 1.0 - (occlusion / kernelCount);
        gl_FragColor = vec4(albedo * occlusion, 1.0);
      }
    `,
    uniforms: {
      noiseTexture,
      kernelTexture,
      noiseScale: ({viewportWidth, viewportHeight}) => ([
        viewportWidth / config.noiseWidth,
        viewportHeight / config.noiseWidth,
      ]),
      kernelCount: config.kernelCount,
      radius: config.radius,
      bias: config.bias,
    }
  })

  return drawSSAO;
}

function createNoiseTetxure(regl, { noiseWidth }) {
  const size = noiseWidth * noiseWidth;
  const data = []
  for (let i = 0; i < size; i++) {
    data.push([
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      0
    ]);
  }
  return regl.texture({
    width: noiseWidth,
    height: noiseWidth,
    wrap: 'repeat',
    data,
    type: 'float',
    format: 'rgb'
  })
}

function createKernelTexture(regl, { kernelSqSize, kernelWidth }) {
  const data = []
  for (let i = 0; i < kernelSqSize; i++) {
    // Create a normalized point in the +Z hemisphere.
    const point = [
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random()
    ];
    vec3.normalize(point, point);

    // Scale the points to be closer to the center.
    let scale = i / kernelSqSize;
    scale = lerp(0.1, 1.0, scale * scale);

    point[0] *= scale;
    point[1] *= scale;
    point[2] *= scale;

    data.push(point);
  }
  console.log({ data })

  return regl.texture({
    width: kernelWidth,
    height: kernelWidth,
    wrap: 'repeat',
    data,
    type: 'float',
    format: 'rgb'
  })
}
