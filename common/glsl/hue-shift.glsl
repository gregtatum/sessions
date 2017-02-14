vec3 hueShift (in vec3 color, in float shift) {
  vec3 p = vec3(0.55735) * dot(vec3(0.55735), color);
  vec3 u = color - p;
  vec3 v = cross(vec3(0.55735), u);
  return u * cos(shift * 6.2832) + v * sin(shift * 6.2832) + p;
}

#pragma glslify: export(hueShift)
