const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = (env, args) => {
  const isProduction = args.mode === "production";

  return {
    entry: {
      entry: "./index.js",
      discovery: "./discovery.js",
      chat_room: "./chat_room.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: isProduction ? "[name].[contenthash].js" : "[name].[hash].js",
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "index.html",
        chunks: ["entry"],
      }),
      new HtmlWebpackPlugin({
        title: "discovery",
        filename: "discovery.html",
        template: "./discovery.html",
        chunks: ["discovery"],
      }),
      new HtmlWebpackPlugin({
        title: "chat_room",
        filename: "chat-room.html",
        template: "./chat-room.html",
        chunks: ["chat_room"],
      }),
      new webpack.ProvidePlugin({
        TextDecoder: ["text-encoding", "TextDecoder"],
        TextEncoder: ["text-encoding", "TextEncoder"],
      }),
    ],
  };
};
