#pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
#pragma glslify: snoise4 = require(glsl-noise/simplex/4d)
#pragma glslify: rotateY = require(../common/glsl/rotateY)
#pragma glslify: hsl2rgb = require(glsl-hsl2rgb)

uniform float time;

vec3 TOP = vec3(0.0, 1.0, 0.0);
vec3 BOTTOM = vec3(0.0, -1.0, 0.0);

vec4 computeBackground (vec3 directionVector, float time) {
  // vec3 direction = 0.5 * (vec3(1.0) + directionVector);
  vec3 direction = directionVector;
  float scaledTime = time * 0.2;

  float noiseRotationNoise = snoise3(vec3(directionVector.xz * 10.0, scaledTime));
  vec3 noiseRotation = rotateY(directionVector, 0.2 * sin(noiseRotationNoise));

  float brightness = 0.8 + dot(direction, TOP);
  brightness = mix(brightness, snoise3(vec3(noiseRotation.xz * 2.5, scaledTime)), 0.2);

  float hue = (direction.y + noiseRotationNoise * 0.05) * 0.25 + 0.1;

  float bottomBrightness = dot(directionVector, BOTTOM);
  vec3 cyan = 0.1 * vec3(0.0, 1.0, 1.0) * bottomBrightness;

  vec3 color = hsl2rgb(hue, 0.4, brightness);
  return vec4(color + cyan, 1.0);
}

#pragma glslify: export(computeBackground)
