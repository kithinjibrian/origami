# Origami Framework

A reactive UI framework that combines the best ideas from Flutter's widget system, React's composition model, and fine-grained reactivity systems like SolidJS. Origami provides a declarative way to build web applications with explicit state machines, dependency injection, and efficient DOM updates.

## Table of Contents

- [Philosophy](#philosophy)
- [Core Concepts](#core-concepts)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Widget Types](#widget-types)
- [Reactivity System](#reactivity-system)
- [State Machines](#state-machines)
- [Dependency Injection](#dependency-injection)
- [Comparison with Other Frameworks](#comparison-with-other-frameworks)
- [Novel Solutions](#novel-solutions)
- [Advanced Examples](#advanced-examples)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Philosophy

Origami is built on three core principles:

1. **Explicit State Transitions**: State changes should be predictable and declarative through finite state machines
2. **Fine-Grained Reactivity**: Only update what changed, without virtual DOM diffing
3. **Flutter-Inspired Composition**: Widgets compose naturally with clear lifecycle management

## Core Concepts

### Widgets

Everything in Origami is a widget. There are three main widget types:

- **ImmutableWidget**: Stateless widgets that rebuild completely when their parent rebuilds
- **MutableWidget**: Stateful widgets that manage their own state and lifecycle
- **InheritedWidget**: Special widgets that propagate data down the widget tree

### Build Context

Every widget receives a `BuildContext` that provides:
- Access to ancestor widgets
- Dependency injection container
- Lifecycle management

### Signals

Fine-grained reactive primitives that automatically track dependencies and trigger updates only where needed.

## Installation

```bash
npm install @kithinji/origami
# or
yarn add @kithinji/origami
```

## Quick Start

```typescript
import { ImmutableWidget, MutableWidget, DataWidget, BuildContext } from '@kithinji/origami';

// Simple stateless widget
class Greeting extends ImmutableWidget {
  constructor(private name: string) {
    super();
  }

  build(context: BuildContext) {
    return new Text(`Hello, ${this.name}!`);
  }
}

// Stateful counter widget
class Counter extends MutableWidget {
  createMutable() {
    return new CounterData(this);
  }
}

class CounterData extends DataWidget<Counter> {
  private count!: Signal<number>;

  init() {
    // Create a reactive signal
    this.count = this.signal(0, 'count');

    // Set up automatic DOM updates
    this.effect(() => {
      console.log(`Count changed to: ${this.count.value}`);
    });
  }

  build(context: BuildContext) {
    return new Column([
      new Text(`Count: ${this.count.value}`),
      new Button({
        label: 'Increment',
        onClick: () => this.count.value++
      })
    ]);
  }
}

// Mount to DOM
const app = new Counter();
document.body.appendChild(app.render(new BuildContext(app)));
```

## Widget Types

### ImmutableWidget

Use for stateless components that don't need to manage their own state.

```typescript
class UserCard extends ImmutableWidget {
  constructor(
    private user: { name: string; email: string; avatar: string }
  ) {
    super({ debugLabel: 'UserCard' });
  }

  build(context: BuildContext) {
    return new Container({
      children: [
        new Image({ src: this.user.avatar, alt: this.user.name }),
        new Text(this.user.name),
        new Text(this.user.email)
      ]
    });
  }
}
```

### MutableWidget with DataWidget

Use when you need reactive state management.

```typescript
class TodoList extends MutableWidget {
  createMutable() {
    return new TodoListData(this);
  }
}

class TodoListData extends DataWidget<TodoList> {
  private todos!: Signal<Array<{ id: string; text: string; done: boolean }>>;
  private filter!: Signal<'all' | 'active' | 'completed'>;

  init() {
    // Initialize reactive state
    this.todos = this.signal([], 'todos');
    this.filter = this.signal('all', 'filter');

    // Derived signal - automatically updates when todos or filter changes
    const filteredTodos = this.derived(() => {
      const todos = this.todos.value;
      const filter = this.filter.value;
      
      if (filter === 'active') return todos.filter(t => !t.done);
      if (filter === 'completed') return todos.filter(t => t.done);
      return todos;
    }, 'filteredTodos');
  }

  private addTodo(text: string) {
    // Signal updates are batched and efficient
    this.todos.value = [
      ...this.todos.value,
      { id: crypto.randomUUID(), text, done: false }
    ];
  }

  private toggleTodo(id: string) {
    this.todos.value = this.todos.value.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    );
  }

  build(context: BuildContext) {
    const filtered = this.filteredTodos.value;
    
    return new Column([
      new TodoInput({ onSubmit: (text) => this.addTodo(text) }),
      new FilterButtons({ 
        current: this.filter.value,
        onChange: (f) => this.filter.value = f 
      }),
      ...filtered.map(todo => 
        new TodoItem({
          todo,
          onToggle: () => this.toggleTodo(todo.id)
        })
      )
    ]);
  }
}
```

### MutableWidget with StateWidget

Use for complex state machines with explicit state transitions.

```typescript
// Define your states and events
type FormState = 'editing' | 'validating' | 'submitting' | 'success' | 'error';

type FormEvents = {
  SUBMIT: { email: string; password: string };
  RETRY: void;
  RESET: void;
};

class LoginForm extends MutableWidget {
  createMutable() {
    return new LoginFormState(this, { init: 'editing' });
  }
}

class LoginFormState extends StateWidget<LoginForm, FormState, FormEvents> {
  private email!: Signal<string>;
  private password!: Signal<string>;
  private errorMessage!: Signal<string>;

  init() {
    this.email = this.signal('', 'email');
    this.password = this.signal('', 'password');
    this.errorMessage = this.signal('', 'errorMessage');
  }

  // Define allowed state transitions
  states() {
    return {
      editing: 'validating',
      validating: ['editing', 'submitting'],
      submitting: ['success', 'error'],
      success: 'editing',
      error: ['editing', 'submitting']
    };
  }

  // Define what happens during transitions
  transitions() {
    return {
      editing: {
        SUBMIT: async ({ payload }) => {
          // Validation logic
          if (!payload.email || !payload.password) {
            return 'editing';
          }
          return 'validating';
        }
      },
      validating: async () => {
        // Auto-transition after validation
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'submitting';
      },
      submitting: async () => {
        try {
          // Simulated API call
          const response = await fetch('/api/login', {
            method: 'POST',
            body: JSON.stringify({
              email: this.email.value,
              password: this.password.value
            })
          });
          
          if (response.ok) {
            return 'success';
          } else {
            this.errorMessage.value = 'Invalid credentials';
            return 'error';
          }
        } catch (err) {
          this.errorMessage.value = 'Network error';
          return 'error';
        }
      },
      success: {
        RESET: 'editing'
      },
      error: {
        RETRY: 'submitting',
        RESET: 'editing'
      }
    };
  }

  // Define UI for each state
  build(context: BuildContext) {
    return {
      editing: ({ state, context }) => new Column([
        new Input({
          value: this.email.value,
          onChange: (v) => this.email.value = v,
          placeholder: 'Email'
        }),
        new Input({
          value: this.password.value,
          onChange: (v) => this.password.value = v,
          placeholder: 'Password',
          type: 'password'
        }),
        new Button({
          label: 'Login',
          onClick: () => this.send('SUBMIT', {
            email: this.email.value,
            password: this.password.value
          })
        })
      ]),
      
      validating: ({ state, context }) => new Column([
        new Spinner(),
        new Text('Validating...')
      ]),
      
      submitting: ({ state, context }) => new Column([
        new Spinner(),
        new Text('Logging in...')
      ]),
      
      success: ({ state, context }) => new Column([
        new Icon({ name: 'check', color: 'green' }),
        new Text('Login successful!'),
        new Button({
          label: 'Done',
          onClick: () => this.send('RESET')
        })
      ]),
      
      error: ({ state, context }) => new Column([
        new Icon({ name: 'error', color: 'red' }),
        new Text(this.errorMessage.value),
        new Button({
          label: 'Retry',
          onClick: () => this.send('RETRY')
        }),
        new Button({
          label: 'Back',
          onClick: () => this.send('RESET')
        })
      ])
    };
  }
}
```

## Reactivity System

Origami uses fine-grained reactivity similar to SolidJS, but integrated with a Flutter-style widget system.

### Signals

```typescript
class ReactiveExample extends DataWidget<SomeWidget> {
  private counter!: Signal<number>;
  private doubled!: Signal<number>;

  init() {
    // Basic signal
    this.counter = this.signal(0, 'counter');

    // Derived signal - automatically recomputes when dependencies change
    this.doubled = this.derived(() => {
      return this.counter.value * 2;
    }, 'doubled');

    // Effect - runs whenever dependencies change
    this.effect(() => {
      console.log(`Counter: ${this.counter.value}, Doubled: ${this.doubled.value}`);
      
      // Optional cleanup function
      return () => {
        console.log('Effect cleanup');
      };
    }, 'logger');
  }

  build(context: BuildContext) {
    // Access signal values
    return new Text(`${this.counter.value} × 2 = ${this.doubled.value}`);
  }
}
```

### Automatic Dependency Tracking

Signals automatically track which effects depend on them:

```typescript
private setupReactivity() {
  const firstName = this.signal('John');
  const lastName = this.signal('Doe');
  
  // This effect only re-runs when firstName changes
  this.effect(() => {
    console.log(`First: ${firstName.value}`);
  });
  
  // This effect only re-runs when lastName changes
  this.effect(() => {
    console.log(`Last: ${lastName.value}`);
  });
  
  // This effect re-runs when either changes
  this.effect(() => {
    console.log(`Full: ${firstName.value} ${lastName.value}`);
  });
}
```

### Batched Updates

Multiple signal updates are automatically batched:

```typescript
private updateUser() {
  // These three updates trigger only ONE rebuild
  this.firstName.value = 'Jane';
  this.lastName.value = 'Smith';
  this.age.value = 30;
}
```

## State Machines

State machines in Origami provide type-safe, predictable state management.

### Pattern Matching

The framework supports multiple pattern matching strategies:

```typescript
build(context: BuildContext) {
  return {
    // Exact match
    'idle': ({ state }) => new IdleWidget(),
    
    // Multiple states (OR)
    'loading|saving': ({ state }) => new LoadingWidget(state),
    
    // Prefix wildcard
    'error.*': ({ state }) => new ErrorWidget(state),
    
    // Regex pattern
    '/^fetch_[a-z]+$/': ({ state }) => new FetchWidget(state),
    
    // Fallback wildcard
    '*': ({ state }) => new UnknownStateWidget(state)
  };
}
```

### Transition Rules

Add validation to state transitions:

```typescript
states() {
  return {
    draft: {
      next: ['reviewing', 'archived'],
      rules: [
        (current, next) => {
          // Only allow review if content is not empty
          if (next === 'reviewing') {
            return this.content.value.length > 0;
          }
          return true;
        }
      ]
    },
    reviewing: ['approved', 'rejected', 'draft'],
    approved: 'published',
    published: 'archived',
    rejected: 'draft',
    archived: []
  };
}
```

### Complex State Machine Example

```typescript
type AuthState = 
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated'
  | 'refreshing_token'
  | 'token_expired'
  | 'error';

type AuthEvents = {
  LOGIN: { username: string; password: string };
  LOGOUT: void;
  REFRESH: void;
  TOKEN_EXPIRED: void;
};

class AuthManager extends StateWidget<AuthWidget, AuthState, AuthEvents> {
  private token!: Signal<string | null>;
  private user!: Signal<User | null>;

  states() {
    return {
      unauthenticated: 'authenticating',
      authenticating: ['authenticated', 'error'],
      authenticated: ['refreshing_token', 'token_expired', 'unauthenticated'],
      refreshing_token: ['authenticated', 'token_expired'],
      token_expired: ['authenticating', 'unauthenticated'],
      error: ['authenticating', 'unauthenticated']
    };
  }

  transitions() {
    return {
      unauthenticated: {
        LOGIN: async ({ payload }) => {
          return 'authenticating';
        }
      },
      authenticating: async () => {
        try {
          const response = await this.authenticate();
          this.token.value = response.token;
          this.user.value = response.user;
          this.scheduleTokenRefresh();
          return 'authenticated';
        } catch (err) {
          return 'error';
        }
      },
      authenticated: {
        LOGOUT: 'unauthenticated',
        REFRESH: 'refreshing_token',
        TOKEN_EXPIRED: 'token_expired'
      },
      refreshing_token: async () => {
        try {
          const newToken = await this.refreshToken(this.token.value!);
          this.token.value = newToken;
          return 'authenticated';
        } catch (err) {
          return 'token_expired';
        }
      },
      token_expired: {
        LOGIN: 'authenticating',
        LOGOUT: 'unauthenticated'
      },
      error: {
        LOGIN: 'authenticating',
        LOGOUT: 'unauthenticated'
      }
    };
  }

  private scheduleTokenRefresh() {
    // Schedule token refresh before expiry
    setTimeout(() => {
      if (this.getCurrentState() === 'authenticated') {
        this.send('REFRESH');
      }
    }, 14 * 60 * 1000); // 14 minutes
  }
}
```

## Dependency Injection

Origami provides a simple but powerful dependency injection system.

### Providing Services

```typescript
// Define an injectable service
@Injectable
class UserService {
  async fetchUser(id: string): Promise<User> {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  }
}

@Injectable
class AuthService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }
}

// Provide services at app root
class App extends ImmutableWidget {
  build(context: BuildContext) {
    // Provide singleton instances
    context.provide(UserService, new UserService());
    context.provide(AuthService, new AuthService());
    
    // Or provide factory functions
    context.provide(LoggerService, () => new LoggerService(context));

    return new HomePage();
  }
}
```

### Consuming Services

```typescript
class UserProfile extends MutableWidget {
  createMutable() {
    return new UserProfileData(this);
  }
}

class UserProfileData extends DataWidget<UserProfile> {
  private user!: Signal<User | null>;

  async init() {
    this.user = this.signal(null, 'user');

    // Read services from context
    const userService = this.context.read(UserService);
    const authService = this.context.read(AuthService);

    // Use services
    this.effect(async () => {
      const token = authService.getToken();
      if (token) {
        const userData = await userService.fetchUser('current');
        this.user.value = userData;
      }
    });
  }

  build(context: BuildContext) {
    const user = this.user.value;
    
    if (!user) {
      return new LoadingSpinner();
    }

    return new UserCard(user);
  }
}
```

### InheritedWidget for Theme/Config

```typescript
class ThemeData extends InheritedWidget {
  constructor(
    private theme: { primary: string; secondary: string },
    child: Widget
  ) {
    super(child);
  }

  updateShouldNotify(oldWidget: ThemeData): boolean {
    return this.theme !== (oldWidget as ThemeData).theme;
  }

  static of(context: BuildContext): ThemeData {
    return context.dependOnInheritedWidgetOfExactTypeRequired(ThemeData);
  }
}

// Usage
class ThemedButton extends ImmutableWidget {
  build(context: BuildContext) {
    const theme = ThemeData.of(context);
    
    return new Button({
      style: { backgroundColor: theme.primary }
    });
  }
}
```

## Comparison with Other Frameworks

### vs React

| Feature | React | Origami |
|---------|-------|---------|
| **Reactivity** | Virtual DOM diffing | Fine-grained signals |
| **State Management** | useState, useReducer, external libraries | Built-in signals and state machines |
| **Updates** | Re-renders entire component tree | Only updates changed signals |
| **State Machines** | External libraries (XState) | First-class support |
| **Type Safety** | Good with TypeScript | Excellent with TypeScript |
| **Learning Curve** | Moderate | Moderate-High |

```typescript
// React
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// Origami
class Counter extends MutableWidget {
  createMutable() { return new CounterData(this); }
}
class CounterData extends DataWidget<Counter> {
  private count = this.signal(0);
  build() { return new Button({ onClick: () => this.count.value++ }); }
}
```

### vs SolidJS

| Feature | SolidJS | Origami |
|---------|---------|---------|
| **Reactivity** | Fine-grained signals | Fine-grained signals |
| **Widget System** | JSX components | Class-based widgets |
| **State Machines** | Not built-in | First-class support |
| **Lifecycle** | Simple | Explicit with BuildContext |
| **Composition** | Function composition | Widget composition |

```typescript
// SolidJS
function Counter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}

// Origami - similar reactivity, different structure
class CounterData extends DataWidget<Counter> {
  private count = this.signal(0);
  build() { return new Button({ label: this.count.value }); }
}
```

### vs Flutter

| Feature | Flutter | Origami |
|---------|---------|---------|
| **Widget System** | Widget tree | Widget tree |
| **State Management** | setState, Provider, Bloc | Signals and state machines |
| **Platform** | Mobile/Desktop | Web |
| **Language** | Dart | TypeScript |
| **Reactivity** | Full rebuilds | Fine-grained |

```dart
// Flutter
class Counter extends StatefulWidget {
  @override
  _CounterState createState() => _CounterState();
}
class _CounterState extends State<Counter> {
  int count = 0;
  @override
  Widget build(context) {
    return Button(onPressed: () => setState(() => count++));
  }
}

// Origami - similar structure, better reactivity
class CounterData extends DataWidget<Counter> {
  private count = this.signal(0);
  build() { return new Button({ onClick: () => this.count.value++ }); }
}
```

### vs Svelte

| Feature | Svelte | Origami |
|---------|---------|---------|
| **Reactivity** | Compiler-based | Runtime signals |
| **Syntax** | Template syntax | TypeScript classes |
| **State Machines** | Not built-in | First-class support |
| **Build Step** | Required (compiler) | Optional |
| **Type Safety** | Good | Excellent |

## Novel Solutions

### 1. State Machines as First-Class Citizens

Most frameworks treat state machines as an afterthought, requiring external libraries like XState. Origami makes them a core primitive:

```typescript
// Complex async workflows are declarative and type-safe
class DataFetcher extends StateWidget<Widget, FetchState, FetchEvents> {
  states() {
    return {
      idle: 'fetching',
      fetching: ['success', 'error'],
      success: 'idle',
      error: ['idle', 'fetching']
    };
  }

  // Transitions handle the complexity
  transitions() {
    return {
      idle: { FETCH: 'fetching' },
      fetching: async () => {
        try {
          const data = await this.fetchData();
          this.data.value = data;
          return 'success';
        } catch {
          return 'error';
        }
      },
      success: { REFETCH: 'fetching' },
      error: { RETRY: 'fetching', CANCEL: 'idle' }
    };
  }
}
```

### 2. Flutter-Style Composition + Fine-Grained Reactivity

Origami combines Flutter's intuitive widget composition with SolidJS-style reactivity:

```typescript
// No virtual DOM, no diffing, just surgical updates
class TodoListData extends DataWidget<TodoList> {
  private todos = this.signal<Todo[]>([]);
  
  build() {
    // Only the changed todo item updates, not the entire list
    return new Column(
      this.todos.value.map(todo => 
        new TodoItem({ 
          todo,
          // This specific item updates when toggled
          onToggle: () => this.toggleTodo(todo.id)
        })
      )
    );
  }
}
```

### 3. BuildContext as Dependency Injection Container

Unlike React's Context (which triggers re-renders) or manual DI, Origami's BuildContext provides:

```typescript
// Services are scoped to widget subtrees
class ParentWidget extends ImmutableWidget {
  build(context: BuildContext) {
    // Provide service at this level
    context.provide(DataService, new DataService());
    
    return new ChildWidget(); // Can access DataService
  }
}

// Child widgets access without prop drilling
class ChildData extends DataWidget<ChildWidget> {
  init() {
    // Direct access, no props, no context drilling
    const service = this.context.read(DataService);
  }
}
```

### 4. Explicit Widget Anchors

Origami uses comment nodes as anchors for precise DOM updates:

```typescript
// Framework tracks exact insertion points
// Enables efficient updates without virtual DOM
private rebuild(newElement: Node) {
  const anchor = this.widget.anchor;
  const parent = anchor.parentNode;
  
  // Surgical replacement starting from anchor
  let next = anchor.nextSibling;
  while (next) {
    parent.removeChild(next);
    next = anchor.nextSibling;
  }
  parent.appendChild(newElement);
}
```

### 5. Automatic Effect Cleanup

Effects are tied to widget lifecycle:

```typescript
class SubscriptionWidget extends DataWidget<Widget> {
  init() {
    // Effect automatically cleaned up when widget disposes
    this.effect(() => {
      const subscription = someStream.subscribe(data => {
        this.data.value = data;
      });
      
      // Cleanup runs on effect disposal
      return () => subscription.unsubscribe();
    });
  }
}
```

## Best Practices

### 1. Use Appropriate Widget Types

```typescript
// ✅ Good: Stateless = ImmutableWidget
class UserAvatar extends ImmutableWidget {
  build() { return new Image({ src: this.user.avatar }); }
}

// ✅ Good: Reactive state = DataWidget
class Counter extends DataWidget {
  private count = this.signal(0);
  build() { return new Text(this.count.value); }
}

// ✅ Good: Complex state = StateWidget
class CheckoutFlow extends StateWidget {
  states() { return { cart: 'shipping', shipping: 'payment' }; }
}
```

### 2. Name Your Signals

```typescript
// ✅ Good: Debug labels help track updates
this.count = this.signal(0, 'count');
this.user = this.signal(null, 'user');

this.effect(() => {
  console.log(this.count.value);
}, 'count-logger');
```

### 3. Scope Services Appropriately

```typescript
// ✅ Good: App-level services at root
class App extends ImmutableWidget {
  build(context) {
    context.provide(AuthService, new AuthService());
    return new HomePage();
  }
}

// ✅ Good: Feature services in feature root
class UserProfilePage extends ImmutableWidget {
  build(context) {
    context.provide(UserProfileService, new UserProfileService());
    return new UserProfile();
  }
}
```

### 4. Handle Errors Gracefully

```typescript
class SafeWidget extends DataWidget<Widget> {
  private data = this.signal(null);
  private error = this.signal(null);

  async init() {
    try {
      const result = await fetchData();
      this.data.value = result;
    } catch (err) {
      this.error.value = err;
      this.logError('Failed to fetch data', err);
    }
  }

  build(context: BuildContext) {
    if (this.error.value) {
      return new ErrorWidget(this.error.value);
    }
    return new DataWidget(this.data.value);
  }
}
```

### 5. Use Derived Signals for Computed Values

```typescript
// ✅ Good: Derived signal automatically updates
private total = this.derived(() => {
  return this.items.value.reduce((sum, item) => sum + item.price, 0);
}, 'total');

// ❌ Bad: Manual updates error-prone
private updateTotal() {
  this.total.value = this.items.value.reduce(...);
}
```

## API Reference

### Widget Classes

#### `ImmutableWidget`
Stateless widget that rebuilds completely when parent changes.

```typescript
abstract class ImmutableWidget extends Widget {
  abstract build(context: BuildContext): Widget;
}
```

#### `MutableWidget`
Stateful widget with lifecycle management.

```typescript
abstract class MutableWidget extends Widget {
  abstract createMutable(): Mutable<this, any>;
}
```

#### `DataWidget<T>`
Mutable widget with reactivity support.

```typescript
abstract class DataWidget<T extends MutableWidget> extends Mutable<T, Widget> {
  signal<V>(value: V, debugLabel?: string): Signal<V>
  derived<V>(fn: () => V, debugLabel?: string): Signal<V>
  effect(fn: () => void | (() => void), debugLabel?: string): () => void
  abstract build(context: BuildContext): Widget
}
```

#### `StateWidget<T, S, E>`
State machine widget with typed states and events.

```typescript
abstract class StateWidget<T, S extends string, E extends Record<string, unknown>> {
  abstract states(): States<S>
  transitions(): Transitions<S, E> | null
  getCurrentState(): S
  send<K extends keyof E>(event: K, payload: E[K]): void
  protected shift(next: S): void
  abstract build(context: BuildContext): Widgets<S>
}
```

### BuildContext

```typescript
class BuildContext {
  provide<T>(type: Type<T>, provider: Provider<T>): void
  read<T>(type: Type<T>): T
  dependOnInheritedWidgetOfExactType<T>(type: Type<T>): T | null
  dispose(): void
}
```

### Decorators

```typescript
@Injectable
class MyService { }
```

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for developers who value explicit state management and fine-grained reactivity.