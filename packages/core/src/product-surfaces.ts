/**
 * Product areas the apps show. A hidden area keeps its screens and backend;
 * only its entry points read this list, so web and mobile hide the same things.
 */
export const PRODUCT_SURFACES: Readonly<{
  /** Group chats with several bots. */
  groups: boolean;
  /** Creating and switching between spaces. */
  spaces: boolean;
  /** The integrations hub: plugins, MCP servers and server integrations. */
  integrations: boolean;
  /** The account row at the foot of the web sidebar. */
  accountMenu: boolean;
}> = {
  groups: false,
  spaces: false,
  integrations: false,
  accountMenu: false,
};
