float pixelsFrom(vec2 point, vec2 uv, vec2 resolution) {
  return distance(point, uv * resolution);
}

float getDistanceFromBrush(
  vec2 brushCenter,
  vec2 uv,
  float brushSize,
  vec2 resolution
) {
  return (
    // Keep in 0 to 1 range
    clamp(0.0, 1.0,
      // Flip the black and white values
      1.0 -
      // Shape the curve from linear to cubic to make a softer brush.
      pow(
        // Change the distance in terms of a brush size
        pixelsFrom(brushCenter, uv, resolution) / (brushSize * resolution.y),
        1.0
      )
    )
  );
}

#pragma glslify: export(getDistanceFromBrush)
