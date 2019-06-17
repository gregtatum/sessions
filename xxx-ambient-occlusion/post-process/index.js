module.exports = function (regl) {
  const sceneFBO = regl.framebuffer({
    color: regl.texture({
      wrap: 'clamp'
    }),
    depth: true
  })

  const useSceneFBO = regl({
    context: { sceneFBO }
  })

  return {
    drawSceneToFramebuffer: regl({
      framebuffer: ({viewportWidth, viewportHeight}) => {
        sceneFBO.resize(viewportWidth, viewportHeight)
        return sceneFBO
      }
    }),
    drawPostProcessing: useSceneFBO
  }
}
