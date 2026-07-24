import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import type {
  DetectedCallSite,
  DetectionResult,
  SupportedProvider,
} from './types.js';

type BindingRole = 'client' | 'command' | 'constructor' | 'factory';

interface ImportBinding {
  provider: SupportedProvider;
  role: BindingRole;
}

interface ModuleDefinition {
  defaultRole?: BindingRole;
  namespaceRole?: BindingRole;
  namedRoles?: Readonly<Record<string, BindingRole>>;
  provider: SupportedProvider;
}

const moduleDefinitions: Readonly<Record<string, ModuleDefinition>> = {
  openai: {
    provider: 'openai',
    defaultRole: 'constructor',
    namedRoles: {
      OpenAI: 'constructor',
    },
  },
  '@anthropic-ai/sdk': {
    provider: 'anthropic',
    defaultRole: 'constructor',
    namedRoles: {
      Anthropic: 'constructor',
    },
  },
  '@googlemaps/google-maps-services-js': {
    provider: 'google-maps',
    namedRoles: {
      Client: 'constructor',
    },
  },
  twilio: {
    provider: 'twilio',
    defaultRole: 'factory',
  },
  '@aws-sdk/client-s3': {
    provider: 'aws-s3',
    namedRoles: {
      S3Client: 'constructor',
      PutObjectCommand: 'command',
    },
  },
  '@sendgrid/mail': {
    provider: 'sendgrid',
    defaultRole: 'client',
    namespaceRole: 'client',
  },
};

const traverse = traverseModule.default;

export function detectPaidApiCalls(
  source: string,
  file: string,
): DetectionResult {
  let ast: ReturnType<typeof parse>;

  try {
    ast = parse(source, {
      sourceFilename: file,
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    return {
      detections: [],
      skipped: [
        {
          file,
          reason: 'parse_error',
        },
      ],
    };
  }

  const importBindings = new Map<string, ImportBinding>();
  const clientBindings = new Map<string, SupportedProvider>();
  const detections: DetectedCallSite[] = [];

  traverse(ast, {
    ImportDeclaration(path) {
      registerImportBindings(path.node, importBindings, clientBindings);
    },
    VariableDeclarator(path) {
      registerClientBinding(path.node, importBindings, clientBindings);
    },
    CallExpression(path) {
      const detection = createDetection(
        path.node,
        file,
        importBindings,
        clientBindings,
      );

      if (detection !== null) {
        detections.push(detection);
      }
    },
  });

  return {
    detections,
    skipped: [],
  };
}

function registerImportBindings(
  node: t.ImportDeclaration,
  importBindings: Map<string, ImportBinding>,
  clientBindings: Map<string, SupportedProvider>,
): void {
  const definition = moduleDefinitions[node.source.value];
  if (definition === undefined) {
    return;
  }

  for (const specifier of node.specifiers) {
    const role = getImportRole(specifier, definition);
    if (role === undefined) {
      continue;
    }

    const binding = {
      provider: definition.provider,
      role,
    } satisfies ImportBinding;

    importBindings.set(specifier.local.name, binding);

    if (role === 'client') {
      clientBindings.set(specifier.local.name, definition.provider);
    }
  }
}

function getImportRole(
  specifier: t.ImportDeclaration['specifiers'][number],
  definition: ModuleDefinition,
): BindingRole | undefined {
  if (t.isImportDefaultSpecifier(specifier)) {
    return definition.defaultRole;
  }

  if (t.isImportNamespaceSpecifier(specifier)) {
    return definition.namespaceRole;
  }

  const importedName = t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value;

  return definition.namedRoles?.[importedName];
}

function registerClientBinding(
  node: t.VariableDeclarator,
  importBindings: ReadonlyMap<string, ImportBinding>,
  clientBindings: Map<string, SupportedProvider>,
): void {
  const nodeInitializer = node.init;
  if (!t.isIdentifier(node.id) || nodeInitializer == null) {
    return;
  }

  const initializer = unwrapExpression(nodeInitializer);
  let importedIdentifier: t.Identifier | null = null;

  if (t.isNewExpression(initializer) && t.isIdentifier(initializer.callee)) {
    importedIdentifier = initializer.callee;
  } else if (
    t.isCallExpression(initializer) &&
    t.isIdentifier(initializer.callee)
  ) {
    importedIdentifier = initializer.callee;
  } else if (t.isIdentifier(initializer)) {
    importedIdentifier = initializer;
  }

  if (importedIdentifier === null) {
    return;
  }

  const binding = importBindings.get(importedIdentifier.name);
  if (
    binding === undefined ||
    (binding.role !== 'constructor' &&
      binding.role !== 'factory' &&
      binding.role !== 'client')
  ) {
    return;
  }

  clientBindings.set(node.id.name, binding.provider);
}

function createDetection(
  node: t.CallExpression,
  file: string,
  importBindings: ReadonlyMap<string, ImportBinding>,
  clientBindings: ReadonlyMap<string, SupportedProvider>,
): DetectedCallSite | null {
  const chain = readMemberChain(node.callee);
  if (chain === null || chain.length < 2) {
    return null;
  }

  const [rootIdentifier] = chain;
  if (rootIdentifier === undefined) {
    return null;
  }

  const provider = clientBindings.get(rootIdentifier);
  if (provider === undefined || !isBillableCall(provider, chain, node)) {
    return null;
  }

  const line = node.loc?.start.line;
  if (line === undefined) {
    return null;
  }

  return {
    provider,
    product: detectProduct(provider, node, importBindings),
    file,
    line,
    snippet: `${chain.join('.')}({...})`,
  };
}

function isBillableCall(
  provider: SupportedProvider,
  chain: readonly string[],
  node: t.CallExpression,
): boolean {
  switch (provider) {
    case 'openai':
      return hasTail(chain, ['chat', 'completions', 'create']);
    case 'anthropic':
      return hasTail(chain, ['messages', 'create']);
    case 'google-maps':
      return hasTail(chain, ['geocode']);
    case 'twilio':
      return hasTail(chain, ['messages', 'create']);
    case 'aws-s3':
      return hasTail(chain, ['send']) && isS3Command(node.arguments[0]);
    case 'sendgrid':
      return hasTail(chain, ['send']);
  }
}

function isS3Command(
  argument: t.CallExpression['arguments'][number] | undefined,
): boolean {
  return (
    t.isNewExpression(argument) &&
    t.isIdentifier(argument.callee) &&
    argument.callee.name.endsWith('Command')
  );
}

function hasTail(
  chain: readonly string[],
  expectedTail: readonly string[],
): boolean {
  return expectedTail.every(
    (segment, index) =>
      chain[chain.length - expectedTail.length + index] === segment,
  );
}

function detectProduct(
  provider: SupportedProvider,
  node: t.CallExpression,
  importBindings: ReadonlyMap<string, ImportBinding>,
): string | null {
  switch (provider) {
    case 'openai':
    case 'anthropic':
      return readStringProperty(node.arguments[0], 'model');
    case 'google-maps':
      return 'geocode';
    case 'twilio':
      return 'messages';
    case 'sendgrid':
      return 'mail';
    case 'aws-s3':
      return readS3CommandProduct(node.arguments[0], importBindings);
  }
}

function readS3CommandProduct(
  argument: t.CallExpression['arguments'][number] | undefined,
  importBindings: ReadonlyMap<string, ImportBinding>,
): string | null {
  if (!t.isNewExpression(argument) || !t.isIdentifier(argument.callee)) {
    return null;
  }

  const binding = importBindings.get(argument.callee.name);
  if (binding?.provider !== 'aws-s3' || binding.role !== 'command') {
    return null;
  }

  return argument.callee.name
    .replace(/Command$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function readStringProperty(
  argument: t.CallExpression['arguments'][number] | undefined,
  propertyName: string,
): string | null {
  if (!t.isObjectExpression(argument)) {
    return null;
  }

  for (const property of argument.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      continue;
    }

    const key = t.isIdentifier(property.key)
      ? property.key.name
      : t.isStringLiteral(property.key)
        ? property.key.value
        : null;

    if (key === propertyName && t.isStringLiteral(property.value)) {
      return property.value.value;
    }
  }

  return null;
}

function readMemberChain(node: t.CallExpression['callee']): string[] | null {
  if (t.isIdentifier(node)) {
    return [node.name];
  }

  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) {
    return null;
  }

  const objectChain = readMemberObjectChain(node.object);
  const propertyName = readMemberPropertyName(node);

  if (objectChain === null || propertyName === null) {
    return null;
  }

  return [...objectChain, propertyName];
}

function readMemberObjectChain(
  node: t.MemberExpression['object'] | t.OptionalMemberExpression['object'],
): string[] | null {
  if (t.isIdentifier(node)) {
    return [node.name];
  }

  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    const objectChain = readMemberObjectChain(node.object);
    const propertyName = readMemberPropertyName(node);

    return objectChain === null || propertyName === null
      ? null
      : [...objectChain, propertyName];
  }

  return null;
}

function readMemberPropertyName(
  node: t.MemberExpression | t.OptionalMemberExpression,
): string | null {
  if (!node.computed && t.isIdentifier(node.property)) {
    return node.property.name;
  }

  if (node.computed && t.isStringLiteral(node.property)) {
    return node.property.value;
  }

  return null;
}

function unwrapExpression(node: t.Expression): t.Expression {
  if (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTypeCastExpression(node)
  ) {
    return unwrapExpression(node.expression);
  }

  return node;
}
