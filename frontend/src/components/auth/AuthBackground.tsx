import React from 'react';

const AuthBackground = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      width: '100%',
      opacity: 0.5,
      backgroundImage: "url('/img/auth/loginbg.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}
  />
);

export default AuthBackground;

