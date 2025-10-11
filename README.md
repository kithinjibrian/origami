# Origami

A TypeScript framework for building reactive web applications with explicit state machines and fine-grained reactivity.

## Overview

Origami is a lightweight UI framework that combines reactive programming with formal state machines to help developers write more predictable, maintainable applications. It emphasizes explicit state transitions, fine-grained reactivity through signals, and a component model that prevents common bugs found in modern frameworks.

## Core Concepts

### Widget System

Origami uses three types of widgets:

- **ImmutableWidget**: Stateless components that rebuild completely on changes
- **MutableWidget**: Stateful components with lifecycle management
- **InheritedWidget**: Provides data down the widget tree (similar to React Context)

### Fine-Grained Reactivity

Unlike React's coarse-grained re-rendering or Vue's template compilation, Origami uses a signal-based reactive system inspired by SolidJS and Svelte 5 runes:

```typescript
// Signals track dependencies automatically
const count = this.signal(0);

// Effects run when dependencies change
this.effect(() => {
  console.log(`Count is now: ${count.value}`);
});

// Derived signals compute from other signals
const doubled = this.derived(() => count.value * 2);
```

### StateWidget: Formal State Machines

The most innovative feature of Origami is **StateWidget**, which enforces formal state machine patterns at the framework level. This solves several critical problems that plague modern applications.

## What Problems Does Origami Solve?

### 1. Invalid State Transitions

**The Problem**: In React, Vue, and Angular, state can be mutated arbitrarily. This leads to bugs where components enter impossible states:

```typescript
// React - nothing prevents this invalid transition
const [status, setStatus] = useState('idle');
setStatus('error'); // Jump from idle directly to error?
setStatus('loading'); // Can we load from error state?
```

**Origami's Solution**: StateWidget enforces valid transitions at compile and runtime:

```typescript
class LoadingStateMachine extends StateWidget<LoadingWidget, LoadingState> {
  states() {
    return {
      idle: 'loading',           // Can only go to loading
      loading: ['success', 'error'], // Can go to success or error
      success: 'idle',           // Can reset to idle
      error: ['idle', 'loading'] // Can retry or reset
    };
  }
  
  // Trying this.shift('error') from 'idle' will throw an error!
}
```

### 2. Race Conditions in Async Operations

**The Problem**: Modern frameworks don't prevent race conditions when multiple async operations are triggered:

```typescript
// React - classic race condition
async function fetchUser(id) {
  setLoading(true);
  const data = await fetch(`/api/user/${id}`);
  setUser(data); // What if another fetch started?
  setLoading(false);
}
```

**Origami's Solution**: StateWidget's transition locking prevents concurrent state changes:

```typescript
transitions() {
  return {
    loading: {
      success: ({ payload }) => {
        // If another transition is in progress, this queues
        // Only the latest transition wins
        return 'success';
      },
      error: ({ payload }) => 'error'
    }
  };
}
```

### 3. Implicit State Relationships

**The Problem**: Related state variables can become desynchronized:

```typescript
// React - these can easily get out of sync
const [isOpen, setIsOpen] = useState(false);
const [isAnimating, setIsAnimating] = useState(false);
const [hasError, setHasError] = useState(false);

// What if isOpen=true, isAnimating=true, hasError=true?
// Is that a valid state?
```

**Origami's Solution**: Single state machine with explicit states:

```typescript
states() {
  return {
    closed: 'opening',
    opening: ['open', 'error'],
    open: 'closing',
    closing: ['closed', 'error'],
    error: 'closed'
  };
}

// Only one state at a time - impossible to be in contradictory states
```

### 4. Conditional Transitions with Rules

StateWidget supports transition rules that other frameworks can't enforce:

```typescript
states() {
  return {
    draft: {
      next: ['published', 'archived'],
      rules: [
        // Can only publish if content is valid
        (current, next) => {
          if (next === 'published') {
            return this.validateContent();
          }
          return true;
        }
      ]
    },
    published: ['draft', 'archived'],
    archived: []
  };
}
```

## Comparison with Other Frameworks

### vs React

**React:**
- Coarse-grained re-rendering (entire component tree)
- Virtual DOM diffing overhead
- No formal state management (relies on external libraries)
- Hooks can cause closure stale state bugs

**Origami:**
- Fine-grained reactivity (only what changed updates)
- Direct DOM manipulation
- Built-in state machines prevent invalid states
- Signals avoid closure issues

```typescript
// React - can cause stale closure bugs
useEffect(() => {
  const timer = setInterval(() => {
    setCount(count + 1); // count is stale!
  }, 1000);
}, []);

// Origami - signals always have current value
this.effect(() => {
  const timer = setInterval(() => {
    count.value++; // Always current
  }, 1000);
});
```

### vs Vue

**Vue:**
- Template compilation adds build complexity
- Options API mixes concerns
- Composition API better but still no state machine enforcement
- Proxy-based reactivity has performance edge cases

**Origami:**
- Pure TypeScript, no compilation required
- Class-based organization
- StateWidget enforces state machine patterns
- Signal-based reactivity is predictable

### vs Svelte

**Svelte:**
- Compiler magic (disappearing framework)
- Stores are simple but lack structure
- No built-in state machine patterns
- Excellent performance

**Origami:**
- Runtime framework with TypeScript
- Explicit state machines
- Similar fine-grained reactivity
- Comparable performance

### vs SolidJS

**Solid** and **Origami** are the most similar. Both use:
- Fine-grained signals
- Direct DOM manipulation
- Minimal re-rendering

**Key Difference**: Origami adds StateWidget for formal state machine patterns, which Solid doesn't provide out of the box.

## Complete Example: Form Wizard

```typescript
import {
  MutableWidget,
  StateWidget,
  BuildContext,
  Widget,
  ImmutableWidget
} from '@kithinji/origami';

// Define the form wizard states
type WizardState = 'personal' | 'address' | 'review' | 'submitting' | 'success' | 'error';

// Define events the wizard can handle
interface WizardEvents {
  next: void;
  back: void;
  submit: void;
  retry: void;
}

// The wizard widget
class FormWizard extends MutableWidget {
  name = 'FormWizard';
  
  createMutable() {
    return new FormWizardState(this);
  }
}

// The state machine logic
class FormWizardState extends StateWidget<FormWizard, WizardState, WizardEvents> {
  name = 'FormWizardState';
  
  // Personal info signals
  private firstName = this.signal('');
  private lastName = this.signal('');
  
  // Address signals
  private street = this.signal('');
  private city = this.signal('');
  
  // Validation state
  private errors = this.signal<string[]>([]);
  
  init() {
    // Track validation in real-time
    this.effect(() => {
      const errs: string[] = [];
      
      if (this.getCurrentState() === 'review') {
        if (!this.firstName.value) errs.push('First name required');
        if (!this.lastName.value) errs.push('Last name required');
        if (!this.street.value) errs.push('Street required');
        if (!this.city.value) errs.push('City required');
      }
      
      this.errors.value = errs;
    });
  }
  
  // Define valid state transitions
  states() {
    return {
      personal: 'address',
      address: ['personal', 'review'],
      review: {
        next: ['address', 'submitting'],
        rules: [
          // Can only submit if no validation errors
          (current, next) => {
            if (next === 'submitting') {
              return this.errors.value.length === 0;
            }
            return true;
          }
        ]
      },
      submitting: ['success', 'error'],
      success: [],
      error: 'review'
    };
  }
  
  // Handle events at each state
  transitions() {
    return {
      personal: {
        next: () => 'address'
      },
      address: {
        next: () => 'review',
        back: () => 'personal'
      },
      review: {
        back: () => 'address',
        submit: async () => {
          // Async transition - framework handles race conditions
          try {
            await this.submitForm();
            return 'success';
          } catch (err) {
            return 'error';
          }
        }
      },
      error: {
        retry: () => 'review'
      }
    };
  }
  
  private async submitForm(): Promise<void> {
    // Simulate API call
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        Math.random() > 0.3 ? resolve(true) : reject(new Error('Network error'));
      }, 2000);
    });
  }
  
  // Map states to widgets
  build(context: BuildContext) {
    return {
      personal: () => new PersonalInfoStep(this.firstName, this.lastName, () => {
        this.send('next');
      }),
      
      address: () => new AddressStep(this.street, this.city, 
        () => this.send('back'),
        () => this.send('next')
      ),
      
      review: () => new ReviewStep({
        firstName: this.firstName.value,
        lastName: this.lastName.value,
        street: this.street.value,
        city: this.city.value,
        errors: this.errors.value,
        onBack: () => this.send('back'),
        onSubmit: () => this.send('submit')
      }),
      
      submitting: () => new LoadingWidget('Submitting form...'),
      
      success: () => new SuccessWidget('Form submitted successfully!'),
      
      error: () => new ErrorWidget('Submission failed', () => this.send('retry'))
    };
  }
}

// Usage
const wizard = new FormWizard();
const root = document.getElementById('app')!;
root.appendChild(wizard.render(new BuildContext(wizard)));
```

## Key Features

### 1. Automatic Dependency Tracking

```typescript
const a = this.signal(1);
const b = this.signal(2);

// Derived signals automatically track dependencies
const sum = this.derived(() => a.value + b.value);

console.log(sum.value); // 3
a.value = 5;
console.log(sum.value); // 7 (automatically updated)
```

### 2. Batched Updates

```typescript
const count = this.signal(0);

this.effect(() => {
  console.log('Count:', count.value);
});

// These updates are batched - effect runs once
count.value = 1;
count.value = 2;
count.value = 3;
// Logs: "Count: 3" (only once)
```

### 3. Effect Cleanup

```typescript
this.effect(() => {
  const timer = setInterval(() => {
    console.log('Tick');
  }, 1000);
  
  // Return cleanup function
  return () => clearInterval(timer);
});
```

### 4. Dependency Injection

```typescript
@Injectable
class UserService {
  getUser(id: string) {
    return fetch(`/api/users/${id}`);
  }
}

class UserProfile extends ImmutableWidget {
  build(context: BuildContext) {
    // Inject service from context
    const userService = context.read(UserService);
    return new UserWidget(userService);
  }
}

// Provide service at root
const root = new BuildContext(rootWidget);
root.provide(UserService, new UserService());
```

### 5. Pattern Matching in State Widgets

```typescript
build(context: BuildContext) {
  return {
    // Exact match
    'loading': () => new LoadingWidget(),
    
    // Multiple states (OR)
    'success|complete': () => new SuccessWidget(),
    
    // Prefix match
    'error.*': () => new ErrorWidget(),
    
    // Regex match
    '/^step-\\d+$/': () => new StepWidget(),
    
    // Wildcard fallback
    '*': () => new FallbackWidget()
  };
}
```

## When to Use Origami

### Good Fit

- **Forms and wizards** - StateWidget excels at multi-step processes
- **Complex UI state** - Loading, error, success patterns
- **Real-time applications** - Fine-grained reactivity is efficient
- **Type-safe applications** - Full TypeScript support
- **Small to medium apps** - Lightweight, no build tooling required

### Not Ideal For

- **Server-side rendering** - Currently client-only
- **Large teams needing ecosystem** - Smaller community than React
- **Apps requiring extensive third-party libraries** - Limited plugin ecosystem
- **Progressive enhancement** - Requires JavaScript

## Performance Characteristics

1. **Fine-grained updates**: Only changed DOM nodes update
2. **No virtual DOM**: Direct DOM manipulation
3. **Batched reactivity**: Multiple signal changes trigger one update
4. **Memory efficient**: Weak references prevent memory leaks
5. **Small bundle size**: ~5KB minified + gzipped (core framework)

## Installation

```bash
npm install @kithinji/origami
```

## Philosophy

Origami believes that:

1. **State machines should be first-class** - Most UI bugs come from invalid state transitions
2. **Reactivity should be fine-grained** - Only what changed should update
3. **Types catch bugs** - Full TypeScript integration, no template DSL
4. **Explicit is better than magic** - Clear what happens when
5. **Composition over configuration** - Build from primitives

## Roadmap

- [ ] Server-side rendering support
- [ ] DevTools browser extension
- [ ] Animation primitives
- [ ] Router with state machine integration
- [ ] Form validation helpers
- [ ] Testing utilities
- [ ] More examples and templates

## Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## License

MIT License - see LICENSE file for details

## Acknowledgments

Origami draws inspiration from:
- **SolidJS** - Fine-grained reactivity
- **Svelte** - Disappearing framework philosophy  
- **Flutter** - Widget composition patterns
- **XState** - State machine patterns
- **Elm** - The Elm Architecture

The name "Origami" reflects the framework's philosophy: folding simple primitives (signals, widgets, state machines) into complex, beautiful applications.