// eslint-disable-next-line import/no-extraneous-dependencies
import * as htmlparser2 from 'htmlparser2';

declare function posthtml(plugins?: readonly posthtml.Plugin[]): posthtml.PostHTML;
declare namespace posthtml {
  type Parser<T = htmlparser2.Options> = (html: string, options?: ParserOptions<T>) => Node[];
  type ParserOptions<T = htmlparser2.Options> = {
    directives?: { name: string | RegExp; start: string; end: string }[];
  } & T;

  type Render = (tree: NodeTree, options?: RenderOptions) => string;
  interface RenderOptions {
    singleTags?: (string | RegExp)[];
    closingSingleTag?: 'tag' | 'slash' | 'default';
  }

  type Options<T = htmlparser2.Options> = ParserOptions<T> &
    RenderOptions & {
      sync?: boolean;
      skipParse?: boolean;
      parser?: Parser<T>;
      render?: Render;
    };

  interface Node {
    tag: string | false;
    attrs: Record<string, string | undefined>;
    content: NodeTree;
  }

  interface Message {
    type: string;
  }

  interface PostHTMLOwn {
    version: string;
    name: string;
    plugins: Plugin[];
    messages: Message[];
    parser: Parser;
    render: Render;
  }

  interface PostHTML extends PostHTMLOwn {
    use(plugin: Plugin): this;
    process<T = htmlparser2.Options>(
      html: string | NodeTree,
      options: Options<T> & { sync: true },
    ): Result;
    process<T = htmlparser2.Options>(
      html: string | NodeTree,
      options?: Options<T>,
    ): Promise<Result>;
  }

  interface Result {
    html: string;
    tree: NodeTree;
    messages: Message[];
  }

  type NodeTreeElement = Node | string | false;
  type NodeTree = NodeTreeElement[];
  interface NodeMatchExpression {
    tag?: string | false;
    attrs?: Record<string, boolean>;
    content?: (string | RegExp | NodeMatchExpression)[];
  }

  interface Api extends NodeTree, PostHTMLOwn {
    walk(cb: (node: NodeTreeElement) => NodeTreeElement): void;
    match(expression: string | RegExp, cb: (node: string) => NodeTreeElement): void;
    match(
      expression: NodeMatchExpression | readonly NodeMatchExpression[],
      cb: (node: Node) => NodeTreeElement,
    ): void;
  }

  type Plugin = (
    tree: Api,
    callback: (error: Error, tree: NodeTree) => void,
  ) => void | NodeTree | Promise<NodeTree>;
}

export = posthtml;
