import * as parser from "@babel/parser";
import * as t from "@babel/types";
import generator from "@babel/generator";
import traverse from "@babel/traverse";
import beautify from "js-beautify";
import axios from "axios";
import fs from "fs";

const validateScript = async url => {
  const resp = await axios.get(url);
  if (resp.status == 200 && resp.data.startsWith("var _ac")) {
    // # its a valid akamai script
    return resp.data;
  }

  // # its not a valid akamai script
  throw new Error("Invalid akamai script...");
};

const deobfuscate = src => {
  let ast = parser.parse(src);
  let astValueArray = null;

  // # first traverse all the node types
  traverse(ast, {
    VariableDeclaration: function(path) {
      // # get the path func name
      const getPathFuncName = path.node.declarations.find(
        n => n.id.name === "_ac"
      );

      if (getPathFuncName) {
        // # grab all value in _ac and use it to get other values
        astValueArray = getPathFuncName.init.elements.map(el => el.value);
      }
    },
    MemberExpression: function(path) {
      // # find all _ac Identifier
      if (path.node.object.name == "_ac") {
        // # replace all with the actual value that we initaially store in our astValueArray
        path.replaceWith(
          t.stringLiteral(astValueArray[path.node.property.value])
        );
      }
    }
  });

  // # traverse the Idenifter so we can format them correctly
  traverse(ast, {
    MemberExpression: function(path) {
      if (path.node.property.type === "StringLiteral") {
        if (path.node.object.name !== undefined) {
          path.replaceWith(
            t.memberExpression(
              path.node.object,
              t.identifier(path.node.property.value),
              false
            )
          );
        }
      }
    }
  });

  let deobfuscateCode = generator(ast, {}, src).code;
  deobfuscateCode = beautify(deobfuscateCode, {
    indent_size: 2,
    space_in_empty_paren: true
  });

  // # write to disk
  writeToDisk(deobfuscateCode);
};

const writeToDisk = data => {
  fs.writeFile(`deobs_akamai_${randomID()}.js`, data, err => {
    if (err) {
      // # something happened
      throw new Error(err);
    }

    console.log("Saved deobfuscate code in file!");
  });
};

const randomID = () => {
  return Math.random()
    .toString(36)
    .substring(2, 36);
};

validateScript(
  "https://www.footpatrol.com/resources/a7295a4eae2082f9f5742adced4807"
)
  .then(src => {
    deobfuscate(src);
  })
  .catch(console.error);
