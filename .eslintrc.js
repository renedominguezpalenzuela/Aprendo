module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // jest.setup.js corre en el entorno de Jest pero vive fuera de __tests__,
      // asi que no lo alcanzan los globals que el preset aplica a los tests.
      files: ['jest.setup.js'],
      env: {jest: true},
    },
  ],
};
