import * as datetime from "./widgets/datetime.js";
import * as ipinfo from "./widgets/ipinfo.js";
import * as links from "./widgets/links.js";
import * as markdown from "./widgets/markdown.js";
import * as feed from "./widgets/feed.js";
import * as todo from "./widgets/todo.js";

export const registry = {
  [datetime.meta.type]: datetime,
  [ipinfo.meta.type]: ipinfo,
  [links.meta.type]: links,
  [markdown.meta.type]: markdown,
  [feed.meta.type]: feed,
  [todo.meta.type]: todo
};

export const widgetTypes = Object.values(registry).map(m => m.meta);
