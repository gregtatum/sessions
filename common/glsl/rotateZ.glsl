vec3 rotateZ(vec3 vector, float theta){
  return vec3(
    vector.x * cos(theta) - vector.y * sin(theta),
    vector.x * sin(theta) + vector.y * cos(theta),
    vector.z
  );
}

#pragma glslify: export(rotateZ)
