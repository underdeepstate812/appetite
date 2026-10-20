// Иконки lucide поставляются как ESM (.mjs), которые jest не грузит; в тестах рисовать их не нужно.
const React = require("react");
const { View } = require("react-native");

module.exports = function IconMock(props) {
  return React.createElement(View, { testID: "icon", ...props });
};
module.exports.default = module.exports;
