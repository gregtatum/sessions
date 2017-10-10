As a quick side note, I try to not adjust font sizes on the session pages, but I want the name of the session to match the text above it. So I come up with some arbitrary names that will fit in that space, for this one I chose "Star Trakking" because it was probably really late at night and I found it hilarious.

I feel like this was one piece that ended up getting shared around a bit. It's kind of a resource hog. I found out later that the noise functions I'm using grow in cost exponentially for every dimension you add. So of course I'm doing tons of 4d noise that is super expensive.

To start with I created a plane with many subdivisions in the geometry so that I could manipulate it. Doing this naively means you waste lots of potential points, so I ended up manipulating it quick a bit with a log function to concentrate points that are closer the user compared to far away so that the level of detail looks nice.

Next I wrote some combined noise functions to create the valleys, and since it's computed realtime in the shader, I parameterized it a little bit with time to give it subtle movements.

Lighting for this one was quite fun. There is red glow that is all around the sphere on the surrounding terrain geometry. This was positioned manually with magic numbers, and I manipulated it with sin waves to give it the same look and feel as the effects that were happening in the sphere.

Also notable here is this is the first time I've used the slightly drunk motion on the camera. I think this gives the sessions an nice feel compared to many static orbit-controlled demos.
