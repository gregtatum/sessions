vec3 rotateX(vec3 vector, float theta){
  return vec3(
    vector.x,
    vector.y * cos(theta) - vector.z * sin(theta),
    vector.y * sin(theta) + vector.z * cos(theta)
  );
}

#pragma glslify: export(rotateX)
