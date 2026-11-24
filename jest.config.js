module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],

  // El preset de React Native no trae `testMatch`, asi que rige el de Jest, que
  // toma por suite CUALQUIER .js bajo __tests__/. Sin esto, los ayudantes de
  // __tests__/support/ fallarian con "Your test suite must contain at least one
  // test".
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/__tests__/support/'],
};
