vec3 rotateY(vec3 vector, float theta){
  return vec3(
    vector.z * sin(theta) + vector.x * cos(theta),
    vector.y,
    vector.z * cos(theta) - vector.x * sin(theta)
  );
}

#pragma glslify: export(rotateY)
