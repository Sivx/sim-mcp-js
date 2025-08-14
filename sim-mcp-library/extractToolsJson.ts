import * as ts from "typescript";

function getJSDoc(n: ts.Node): string {
  const jsDoc = (n as any).jsDoc;
  return jsDoc && jsDoc[0]?.comment ? String(jsDoc[0].comment) : "";
}
function extractEnumValues(node: ts.EnumDeclaration) {
  return node.members.map((m) =>
    m.initializer && ts.isStringLiteral(m.initializer)
      ? m.initializer.text
      : m.initializer && ts.isNumericLiteral(m.initializer)
      ? Number(m.initializer.text)
      : m.name.getText()
  );
}

function inferSchemaFromInitializer(init?: ts.Expression): any {
  if (!init) return { type: "string" };
  if (ts.isStringLiteral(init)) return { type: "string" };
  if (ts.isNumericLiteral(init)) return { type: "number" };
  if (
    init.kind === ts.SyntaxKind.TrueKeyword ||
    init.kind === ts.SyntaxKind.FalseKeyword
  )
    return { type: "boolean" };
  if (ts.isArrayLiteralExpression(init)) return { type: "array", items: {} };
  if (ts.isObjectLiteralExpression(init)) return { type: "object" };
  return { type: "string" };
}

export function extractToolsJson(
  source: string,
  opts: { flattenSingleObjectParam?: boolean } = {}
) {
  const sf = ts.createSourceFile("f.ts", source, ts.ScriptTarget.Latest, true);
  const ifaceMap: Record<string, ts.InterfaceDeclaration> = {};
  const typeMap: Record<string, ts.TypeAliasDeclaration> = {};
  const enumMap: Record<string, ts.EnumDeclaration> = {};
  const tools: any[] = [];

  ts.forEachChild(sf, (n) => {
    if (
      ts.isInterfaceDeclaration(n) &&
      n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      ifaceMap[n.name.text] = n;
    if (
      ts.isTypeAliasDeclaration(n) &&
      n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      typeMap[n.name.text] = n;
    if (
      ts.isEnumDeclaration(n) &&
      n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      enumMap[n.name.text] = n;
  });

  function getNamedSchema(name: string): any {
    if (ifaceMap[name]) return buildObjSchema(ifaceMap[name]);
    if (typeMap[name]) return buildTypeSchema(typeMap[name]);
    if (enumMap[name])
      return {
        type: typeof extractEnumValues(enumMap[name])[0],
        enum: extractEnumValues(enumMap[name]),
      };
    return { type: "string" };
  }
  function buildObjSchema(
    n: ts.InterfaceDeclaration | ts.TypeLiteralNode
  ): any {
    const props: any = {},
      req: string[] = [];
    n.members.forEach((m) => {
      if (!ts.isPropertySignature(m) || !m.name) return;
      const name = m.name.getText();
      const doc = getJSDoc(m),
        type = parseType(m.type, doc),
        p: any = { ...type };
      if (doc) p.description = doc;
      if (!m.questionToken) req.push(name);
      if (doc && /regex/i.test(doc)) {
        const match = doc.match(/regex:\s*\/(.+)\/[a-z]*/i);
        if (match) p.pattern = match[1];
      }
      if (doc && /default/i.test(doc)) {
        const match = doc.match(/default:?\s*([^\s,.)]+)/i);
        if (match) {
          let val = match[1];
          if (p.enum) {
            if (p.enum.includes(val)) p.default = val;
            else if (p.type === "number" && p.enum.includes(Number(val)))
              p.default = Number(val);
          } else if (p.type === "number") {
            const numVal = Number(val);
            p.default = isNaN(numVal) ? val : numVal;
          } else {
            p.default = val;
          }
        }
      }
      props[name] = p;
    });
    const sch: any = { type: "object", properties: props };
    if (req.length) sch.required = req;
    return sch;
  }
  function buildTypeSchema(n: ts.TypeAliasDeclaration): any {
    if (ts.isTypeLiteralNode(n.type)) return buildObjSchema(n.type);
    if (ts.isUnionTypeNode(n.type)) {
      const enums = n.type.types
        .filter((t) => ts.isLiteralTypeNode(t))
        .map(
          (t) =>
            ((t as ts.LiteralTypeNode).literal as ts.LiteralExpression).text
        );
      return enums.length
        ? { type: typeof enums[0], enum: enums }
        : { type: "string" };
    }
    if (ts.isTypeReferenceNode(n.type))
      return getNamedSchema(n.type.typeName.getText());
    if (ts.isArrayTypeNode(n.type))
      return { type: "array", items: parseType(n.type.elementType) };
    if (n.type.kind === ts.SyntaxKind.StringKeyword) return { type: "string" };
    if (n.type.kind === ts.SyntaxKind.NumberKeyword) return { type: "number" };
    if (n.type.kind === ts.SyntaxKind.BooleanKeyword)
      return { type: "boolean" };
    return { type: "string" };
  }
  function parseType(tn: ts.TypeNode | undefined, doc = ""): any {
    if (!tn) return { type: "string" };
    if (
      tn.kind === ts.SyntaxKind.AnyKeyword ||
      tn.kind === ts.SyntaxKind.UnknownKeyword ||
      tn.kind === ts.SyntaxKind.ObjectKeyword ||
      (doc && doc.toLowerCase().includes("type: json"))
    )
      return { type: "object" };
    if (ts.isTypeLiteralNode(tn)) return buildObjSchema(tn);
    if (ts.isUnionTypeNode(tn)) {
      const enums = tn.types
        .filter((t) => ts.isLiteralTypeNode(t))
        .map(
          (t) =>
            ((t as ts.LiteralTypeNode).literal as ts.LiteralExpression).text
        );
      return enums.every((e) => typeof e === "string")
        ? { type: "string", enum: enums }
        : enums.every((e) => typeof e === "number")
        ? { type: "number", enum: enums }
        : { type: "string", enum: enums };
    }
    if (ts.isArrayTypeNode(tn))
      return { type: "array", items: parseType(tn.elementType) };
    if (ts.isTypeReferenceNode(tn)) {
      const ref = tn.typeName.getText();
      if (enumMap[ref])
        return {
          type: typeof extractEnumValues(enumMap[ref])[0],
          enum: extractEnumValues(enumMap[ref]),
        };
      if ((ifaceMap[ref] || typeMap[ref]) && tn.typeArguments)
        return getNamedSchema(ref);
      if (ref === "string" || ref === "String") return { type: "string" };
      if (ref === "number" || ref === "Number") return { type: "number" };
      if (ref === "boolean" || ref === "Boolean") return { type: "boolean" };
      if (ref === "Array" && tn.typeArguments?.length === 1)
        return { type: "array", items: parseType(tn.typeArguments[0]) };
      if (ifaceMap[ref] || typeMap[ref]) return getNamedSchema(ref);
      return { type: "string" };
    }
    if (tn.kind === ts.SyntaxKind.StringKeyword) return { type: "string" };
    if (tn.kind === ts.SyntaxKind.NumberKeyword) return { type: "number" };
    if (tn.kind === ts.SyntaxKind.BooleanKeyword) return { type: "boolean" };
    return { type: "string" };
  }

  function buildGroupedParamsSchema(
    params: readonly ts.ParameterDeclaration[]
  ) {
    const props: any = {},
      req: string[] = [];
    params.forEach((param) => {
      let sch: any = {};
      let def: any = undefined,
        r: boolean;
      const name = param.name.getText();
      if (param.type && ts.isTypeReferenceNode(param.type)) {
        const typeName = param.type.typeName.getText();
        sch = getNamedSchema(typeName);
      } else if (param.type && ts.isTypeLiteralNode(param.type)) {
        sch = buildObjSchema(param.type);
      } else if (
        param.type &&
        (param.type.kind === ts.SyntaxKind.AnyKeyword ||
          param.type.kind === ts.SyntaxKind.UnknownKeyword ||
          param.type.kind === ts.SyntaxKind.ObjectKeyword)
      )
        sch = { type: "object" };
      else if (param.type) {
        if (param.type.kind === ts.SyntaxKind.StringKeyword)
          sch = { type: "string" };
        else if (param.type.kind === ts.SyntaxKind.NumberKeyword)
          sch = { type: "number" };
        else if (param.type.kind === ts.SyntaxKind.BooleanKeyword)
          sch = { type: "boolean" };
        else sch = { type: "string" };
      } else {
        sch = inferSchemaFromInitializer(param.initializer);
      }
      if (param.initializer) {
        r = false;
        if (ts.isStringLiteral(param.initializer)) def = param.initializer.text;
        else if (ts.isNumericLiteral(param.initializer))
          def = Number(param.initializer.text);
        else if (param.initializer.kind === ts.SyntaxKind.TrueKeyword)
          def = true;
        else if (param.initializer.kind === ts.SyntaxKind.FalseKeyword)
          def = false;
      } else {
        r = !param.questionToken;
      }
      if (def !== undefined) sch.default = def;
      if (param.type && getJSDoc(param)) sch.description = getJSDoc(param);
      props[name] = sch;
      if (r) req.push(name);
    });
    const obj: any = { type: "object", properties: props };
    if (req.length) obj.required = req;
    return obj;
  }
  ts.forEachChild(sf, (n) => {
    if (
      ts.isFunctionDeclaration(n) &&
      n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const name = n.name?.text || "";
      const desc = getJSDoc(n);
      let inputSchema: any = { type: "object", properties: {} };
      let positional = false;

      if (n.parameters.length > 1) {
        inputSchema = buildGroupedParamsSchema(n.parameters);
        positional = true;
      } else if (n.parameters.length === 1) {
        const param = n.parameters[0];
        if (
          opts.flattenSingleObjectParam &&
          param.type &&
          (ts.isTypeLiteralNode(param.type) ||
            (ts.isTypeReferenceNode(param.type) &&
              (ifaceMap[param.type.typeName.getText()] ||
                typeMap[param.type.typeName.getText()])))
        ) {
          let flatSchema: any = {};
          if (param.type && ts.isTypeLiteralNode(param.type)) {
            flatSchema = buildObjSchema(param.type);
          } else if (param.type && ts.isTypeReferenceNode(param.type)) {
            flatSchema = getNamedSchema(param.type.typeName.getText());
          }
          inputSchema = flatSchema;
          positional = false;
        } else {
          let propSchema: any = {};
          let def: any = undefined,
            reqFlag: boolean;
          if (param.type && ts.isTypeLiteralNode(param.type)) {
            propSchema = buildObjSchema(param.type);
          } else if (param.type && ts.isTypeReferenceNode(param.type)) {
            propSchema = getNamedSchema(param.type.typeName.getText());
          } else if (param.type) {
            if (param.type.kind === ts.SyntaxKind.StringKeyword)
              propSchema = { type: "string" };
            else if (param.type.kind === ts.SyntaxKind.NumberKeyword)
              propSchema = { type: "number" };
            else if (param.type.kind === ts.SyntaxKind.BooleanKeyword)
              propSchema = { type: "boolean" };
          } else {
            propSchema = inferSchemaFromInitializer(param.initializer);
          }
          if (param.initializer) {
            reqFlag = false;
            if (ts.isStringLiteral(param.initializer))
              def = param.initializer.text;
            else if (ts.isNumericLiteral(param.initializer))
              def = Number(param.initializer.text);
            else if (param.initializer.kind === ts.SyntaxKind.TrueKeyword)
              def = true;
            else if (param.initializer.kind === ts.SyntaxKind.FalseKeyword)
              def = false;
          } else {
            reqFlag = !param.questionToken;
          }
          if (def !== undefined) propSchema.default = def;
          if (getJSDoc(param)) propSchema.description = getJSDoc(param);
          inputSchema = {
            type: "object",
            properties: { [param.name.getText()]: propSchema },
          };
          if (reqFlag) inputSchema.required = [param.name.getText()];
          positional = true; // single non-object param still positional
        }
      }

      tools.push({
        name,
        type: "function",
        description: desc,
        inputSchema,
        positional,
      });
    }
  });

  return tools;
}
