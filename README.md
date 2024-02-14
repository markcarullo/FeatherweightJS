# FeatherweightJS
A Minimalistic Reactive UI Library

### Floats Like a Butterfly, Stings Like a Bee
FeatherweightJS is a minimal yet powerful library designed for building reactive user interfaces. Drawing inspiration from SolidJS's core concepts, this library elegantly packages them into a sleek and compact solution—a *solid* punch above its weight.

- **Compact Size:** Weighing in at only 3.2 kB when minified, FeatherweightJS has a small footprint while delivering impactful reactivity.
- **Simple, No Dependencies:** The entire library is just one JavaScript file—simple, easy to grasp, and free from external dependencies.
- **Focused Reactivity:** Achieve fine-grained reactivity through Signals.

### Versatile Reactivity
Define the reactivity your project needs with both Observables and Signals.

#### Observables
Subscribe to a stream of data or events over time.
```JS
const { observable } = featherweight.core;

const actions = observable();

// Subscribe to actions
const actionsSubscription = actions.subscribe((action) => {
   switch (action) {
      case 'Greet':
         console.log('Hello World!');
         break;
      case 'Welcome':
         console.log('Welcome to FeatherweightJS!');
         break;
      case 'Farewell':
         console.log('See you!');
         unsubscribe();
         break;
   }
});

// Unsubscribe when it's no longer needed
const unsubscribe = () => actionsSubscription.unsubscribe();

// Emit actions
actions.emit('Greet');                      // Logs: 'Hello World!'
actions.emit('Welcome');                    // Logs: 'Welcome to FeatherweightJS!'
actions.emit('Farewell');                   // Logs: 'See you!'
```

#### Signals and Effects
Seamlessly define reactivity through signals and effects in tandem.
```JS
const { signal, effect } = featherweight.core;

// Signals created then used in a computed value here
const greeting = signal('Good morning');
const language = signal('French');
const translated = () => translate(greeting(), language());

// When an effect runs, it automatically subscribes to its signal dependencies
effect(() => console.log(translated()));    // Logs: 'Bonjour'

// The effect will rerun when those dependencies change
language.set('German');                     // Logs: 'Guten Morgen'
language.set('Filipino');                   // Logs: 'Magandang umaga'
greeting.set('How are you?');               // Logs: 'Kamusta?'
```

### Reactive UI
Create reactive user interfaces with an expressive and declarative compositional style.

#### Elements
Define UI elements and bind them to signals conveniently.
```JS
const { signal } = featherweight.core;
const { element, render, remove } = featherweight.ui;

const count = signal(0);

// Base elements can be created as building blocks to extend from
const div = element('div');
const button = element('button');

// Extend base elements easily
const divBordered = div.with({ 'style.border': 'thin dotted slategrey' });

// Elements automatically subscribe or bind to signals when used and update accordingly upon signal changes
const buttonPlus1 = button.with({
   onclick: () => count.set((c) => c + 1),
   innerText: () => `Click to Add 1 to ${count()}`
});
const buttonPlus2 = button.with({
   onclick: () => count.set((c) => c + 2),
   innerText: () => `Click to Add 2 to ${count()}`
});

// Construct user interfaces with a very intuitive syntax
const counter = render([
   divBordered(
      () => `Current count is ${count()}`
   ),
   divBordered(
      buttonPlus1,
      buttonPlus2
   )
]);

// Append rendered elements as usual
document.getElementById('app').append(counter);

// Bound elements can be removed from the DOM, automatically cleaning up their subscriptions
const removeCounter = () => remove(counter);
```

#### Components
Encapsulate UI components and their functionality for reusability and subscription management.
```JS
const { signal } = featherweight.core;
const { element, component } = featherweight.ui;

const div = element('div');
const input = element('input');
const label = element('label');

const divBordered = div.with({ 'style.border': 'thin dotted slategrey' });

// A component manages its subscriptions and can dispose of them when removed from the DOM
const TextInput = component((props) =>
   input.with({
      value: props.signal,
      oninput: (e) => props.signal.set(e.target.value)
   })
);

// Component functions run once, efficiently defining all functionality in a single execution.
const Greeting = component((props) => {
   const firstName = signal(props.firstName);
   const lastName = signal(props.lastName);
   const fullName = () => `${firstName()} ${lastName()}`;

   return div(
      divBordered(
         TextInput({ signal: firstName }),
         TextInput({ signal: lastName })
      ),
      divBordered(
         () => `Hi, ${fullName()}!`
      )
   );
});

const greeting = Greeting({ firstName: 'Jean', lastName: 'Delacroix' });

// Attach components to the DOM similar to other elements
document.getElementById('app').append(greeting.render());

// Components can be removed from the DOM, automatically cleaning up their subscriptions
const removeGreeting = () => greeting.remove();
```

### Expressive Reactivity
Fine-tune reactivity using specialized functions for precise control over updates and computations.

#### Conditional Reactivity
Trigger signal bindings only when they are relevant through the `iif` function.
```JS
const { signal, iif } = featherweight.core;
const { element, component } = featherweight.ui;

// Elements and components definition here

const Greeting = component((props) => {
   const firstName = signal(props.firstName);
   const middleName = signal(props.middleName);
   const lastName = signal(props.lastName);

   // When showMiddleName is set to false, middleName changes do not trigger updates to the element bound to fullName
   const showMiddleName = signal(true);
   const fullName = iif(
      showMiddleName,
      () => `${firstName()} ${middleName()} ${lastName()}`,
      () => `${firstName()} ${lastName()}`
   );

   return div(
      divBordered(
         TextInput({ signal: firstName }),
         TextInput({ signal: middleName }),
         TextInput({ signal: lastName })
      ),
      divBordered(
         () => `Hi, ${fullName()}!`
      ),
      divBordered(
         CheckBox({
            signal: showMiddleName,
            name: 'middleNameToggle',
            label: 'Show Middle Name'
         })
      )
   );
});
```

#### Memoization
Run expensive computations only when their dependency signals change with the `memo` function.
```JS
const { signal, memo } = featherweight.core;
const { element, component } = featherweight.ui;

const div = element('div');
const button = element('button');

function factorial(n) {
   if (n === 0 || n === 1) return 1;
   return n * factorial(n - 1);
}

// Logs 'computing' and runs factorial only once when n changes, instead of 9 times
const Factorial = component(() => {
   const n = signal(1);
   const facto = memo(() => {
      console.log('computing');
      return factorial(n()) + ', ';
   });

   return [
      () => `Factorial of N: ${n()}!`,
      div(facto, facto, facto),
      div(facto, facto, facto),
      div(facto, facto, facto),
      button.with({
         onclick: () => n.set((v) => v + 1),
         textContent: 'N + 1'
      })
   ];
});
```

#### Subscribe Only as Intended
Use signal values inside effects without subscribing to them via `peek` and callback setters.
```JS
const { signal, effect, peek } = featherweight.core;
const { element, component } = featherweight.ui;

const div = element('div');
const button = element('button');

const LapTimer = component(() => {
   const elapsed = signal(0);
   const fastest = signal(Infinity);
   const running = signal(false);
   let interval;

   // This effect is triggered only by the running signal
   effect(() => {
      if (running()) {
         interval = setInterval(() => elapsed.set((v) => v + 1), 1000);
      } else if (interval) {
         clearInterval(interval);
         const current = peek(elapsed);
         fastest.set((previous) => (previous > current ? current : previous));
         elapsed.set(0);
         alert(
            `Current time: ${current} seconds\n` +
            `Fastest time: ${peek(fastest)} seconds`,
         );
      }
   });

   return div(
      () => `Elapsed Time: ${elapsed()} seconds`,
      button.with({
         onclick: () => running.set((v) => !v),
         innerText: () => running() ? 'Stop' : 'Run'
      })
   );
});
```
