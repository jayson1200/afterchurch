const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = (env, args) => {
  const isProduction = args.mode === "production";

  return {
    entry: {
      entry: "/src/index.js",
      discovery: "/src/discovery.js",
      chat_room: "/src/chat_room.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: isProduction ? "[name].[contenthash].js" : "[name].[hash].js",
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "src/index.html",
        chunks: ["entry"],
      }),
      new HtmlWebpackPlugin({
        title: "discovery",
        filename: "discovery.html",
        template: "src/discovery.html",
        chunks: ["discovery"],
      }),
      new HtmlWebpackPlugin({
        title: "chat_room",
        filename: "chat-room.html",
        template: "src/chat-room.html",
        chunks: ["chat_room"],
      }),
      new webpack.ProvidePlugin({
        TextDecoder: ["text-encoding", "TextDecoder"],
        TextEncoder: ["text-encoding", "TextEncoder"],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
  };
};
