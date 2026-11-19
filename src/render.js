import * as T from 'three';
export function pipeline(renderer, height) {
  const width = Math.round(height * 16 / 9);
  renderer.setSize(width,height,false);
  const target = new T.WebGLRenderTarget(width,height,{magFilter:T.NearestFilter,minFilter:T.NearestFilter});
  const screen = new T.Scene();
  const lens = new T.OrthographicCamera(-1,1,1,-1,0,1);
  const material = new T.ShaderMaterial({
    uniforms:{frame:{value:target.texture}},
    vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D frame; varying vec2 v;
    float b2(vec2 p){return mod(2.*p.x+3.*p.y,4.);}
    void main(){
      vec2 p=floor(gl_FragCoord.xy); float d=(4.*b2(mod(p,2.))+b2(mod(floor(p/2.),2.)))/16.;
      vec3 c=texture2D(frame,v).rgb;
      c*=1.-.36*dot(v-.5,v-.5); c*=.99+.01*mod(p.y,2.);
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      gl_FragColor.rgb=floor(gl_FragColor.rgb*31.+d)/31.;
    }`
  });
  screen.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
  const snap = (m) => {
    m.onBeforeCompile = shader => {
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nif(gl_Position.w>.25){vec2 grid=vec2('+width+'.0,'+height+'.0)*.5; gl_Position.xy=mix(gl_Position.xy,floor(gl_Position.xy/gl_Position.w*grid+.5)/grid*gl_Position.w,.35);}');
    };
  };
  renderer.info.autoReset=false;
  return {snap,render(scene,camera){
    renderer.info.reset(); renderer.setRenderTarget(target); renderer.render(scene,camera);
    renderer.setRenderTarget(null); renderer.render(screen,lens);
  }};
}
