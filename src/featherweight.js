const Root = domain();
const Domain = { now: Root };
const Listener = { now: null };
const Watcher = { now: null };

function observable() {
   const observers = new Set();
   const notify = (value) =>
      observers.forEach(
         (observer) =>
            Watcher.now?.has(observer) || (observer(value), Watcher.now?.add(observer))
      );
   return {
      subscribe: (observer) => {
         if (observers.has(observer)) return;
         const { subscriptions } = Domain.now;
         const subscription = {
            unsubscribe: () => {
               observers.delete(observer);
               subscriptions.delete(subscription);
            }
         };
         observers.add(observer);
         subscriptions.add(subscription);
         return subscription;
      },
      emit: (value, watch) =>
         watch ? apply(Watcher, new Set()).call(() => notify(value)) : notify(value)
   };
}

function signal(currentValue) {
   const notifier = observable();
   const notify = () => notifier.emit(void 0, true);
   const value = () => (subscribeListenerTo(notifier), currentValue);
   value.set = (incomingValue) => (
      (incomingValue =
         typeof incomingValue === 'function'
            ? incomingValue(currentValue)
            : incomingValue),
      incomingValue !== currentValue && ((currentValue = incomingValue), notify()),
      currentValue
   );
   value.mutate = (mutateFn) => (mutateFn(currentValue), notify(), currentValue);
   return value;
}

function effect(effectFn, initFn) {
   const subscriptions = [];
   apply(Listener, { action: effectFn, subscriptions }).call(initFn || effectFn);
   return { stop: () => unsubscribeAll(subscriptions) };
}

function memo(memoFn) {
   let memoized;
   let stale = true;
   const proxy = signalProxy();
   const value = proxy.route(memoFn, () => (stale = true));
   return () => {
      proxy.subscribeListener();
      if (stale) {
         stale = false;
         return (memoized = value());
      } else return memoized;
   };
}

function iif(exprFn, truePart, falsePart) {
   let isTrue;
   const proxy = signalProxy();
   const expr = proxy.route(exprFn);
   const onTrue =
      typeof truePart === 'function'
         ? proxy.route(truePart, () => isTrue)
         : () => truePart;
   const onFalse =
      typeof falsePart === 'function'
         ? proxy.route(falsePart, () => !isTrue)
         : () => falsePart;
   return () => {
      proxy.subscribeListener();
      return (isTrue = expr()) ? onTrue() : onFalse();
   };
}

function peek(peekFn) {
   return Listener.now ? apply(Listener, null).call(peekFn) : peekFn();
}

function element(tag, config = {}) {
   const blueprint = (...children) => element(tag, { ...config, children }).finalize();
   blueprint.with = (extension) => element(tag, { ...config, ...extension });
   blueprint.finalize = () => ({
      build: () => {
         const el = document.createElement(tag);
         for (const key in config) {
            if (key === 'children') el.append(buildFragment(config[key]));
            else {
               let setter = null;
               const path = key.split('.');
               const isProperty = el[path[0]] !== undefined;
               if (isProperty) {
                  const targetProp = path.pop();
                  const targetObj = path.reduce((obj, prop) => obj[prop], el);
                  setter = (value) => (targetObj[targetProp] = value);
               } else
                  setter = (value) =>
                     value ? el.setAttribute(key, value) : el.removeAttribute(key);
               const value = config[key];
               if (typeof value === 'function' && !/^on/.test(key))
                  (el._bindings || (el._bindings = [])).push(
                     effect(() => setter(value()))
                  );
               else setter(value);
            }
         }
         return el;
      }
   });
   return blueprint;
}

function component(componentFn) {
   return (...args) => {
      let node = null;
      return {
         render: () => (node = renderWithOwnDomain(() => componentFn(...args))),
         remove: () => node && remove(node)
      };
   };
}

function render(value) {
   return renderWithOwnDomain(() => value);
}

function remove(node) {
   if (node._bindings) node._bindings.forEach((binding) => binding.stop());
   if (node._domain) {
      const { self, parent } = node._domain;
      const domainsToCleanUp = [self];
      for (const { subscriptions, subdomains } of domainsToCleanUp) {
         unsubscribeAll(subscriptions);
         domainsToCleanUp.push(...subdomains);
      }
      parent.subdomains.delete(self);
   }
   if (node.remove) node.remove();
   else if (node._remove) node._remove();
}

function domain() {
   return {
      subscriptions: new Set(),
      subdomains: new Set()
   };
}

function apply(context, next) {
   return {
      call: (task) => {
         const previous = context.now;
         context.now = next;
         try {
            return task();
         } finally {
            context.now = previous;
         }
      }
   };
}

function subscribeListenerTo(notifier, onSubscribe) {
   if (!Listener.now) return;
   const { action, subscriptions } = Listener.now;
   const subscription = notifier.subscribe(action);
   subscription &&
      subscriptions.push(subscription) &&
      onSubscribe &&
      onSubscribe(subscription);
}

function unsubscribeAll(subscriptions) {
   subscriptions.forEach((subscription) => subscription.unsubscribe());
   subscriptions.length = 0;
}

function signalProxy() {
   const notifier = observable();
   const routesSubscriptions = [];
   let listeners = 0;
   return {
      subscribeListener: () =>
         subscribeListenerTo(notifier, (subscription) => {
            const { unsubscribe } = subscription;
            subscription.unsubscribe = () => (
               unsubscribe(), --listeners || routesSubscriptions.forEach(unsubscribeAll)
            );
            listeners++;
         }),
      route: (observedFn, prepFn) => {
         const routeDomain = Domain.now;
         const subscriptions = [];
         routesSubscriptions.push(subscriptions);
         return () => {
            if (subscriptions.length) return peek(observedFn);
            const withDomain = apply(Domain, routeDomain);
            const withListener = apply(Listener, {
               action: () => (!prepFn || prepFn() !== false) && notifier.emit(),
               subscriptions
            });
            return withDomain.call(() => withListener.call(observedFn));
         };
      }
   };
}

function renderWithOwnDomain(renderFn) {
   const self = domain();
   const parent = Domain.now;
   const node = apply(Domain, self).call(() => resolveToNode(peek(renderFn)));
   if (node instanceof DocumentFragment) {
      const children = Array.from(node.children);
      node._remove = () => children.forEach((child) => child.remove());
   }
   node._domain = { self, parent };
   parent.subdomains.add(self);
   return node;
}

function buildFragment(items) {
   return items.reduce(
      (fragment, item) => (fragment.appendChild(resolveToNode(item)), fragment),
      document.createDocumentFragment()
   );
}

function createTextNode(observedFn) {
   let textNode;
   const binding = effect(
      () => (textNode.nodeValue = observedFn()),
      () => (textNode = document.createTextNode(observedFn()))
   );
   textNode._bindings = [binding];
   return textNode;
}

function resolveToNode(value) {
   if (value === undefined || value === null) return;
   if (value instanceof Node) return value;
   if (Array.isArray(value)) return buildFragment(value);
   if (value.finalize) return resolveToNode(value.finalize());
   if (value.build) return resolveToNode(value.build());
   if (value.render) return resolveToNode(value.render());
   if (typeof value === 'function') return createTextNode(value);
   return document.createTextNode(value);
}

export default {
   core: { observable, signal, effect, memo, iif, peek },
   ui: { element, component, render, remove }
};
