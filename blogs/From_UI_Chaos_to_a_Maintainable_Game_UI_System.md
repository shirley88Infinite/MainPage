# From UI Chaos to a Maintainable Game UI System

Small game projects rarely begin with a UI architecture problem. They begin with a start button, a menu, and a few callbacks. At that point, almost any implementation appears to work.

The problem arrives through iteration. A pause screen becomes a revive flow. A result screen gains rewards. Then come settings, shops, onboarding, confirmations, network errors, achievement notices, and multiple role-specific dashboards. Before long, panels begin opening other panels directly, buttons perform unrelated operations, and a simple change becomes a regression risk across several systems.

This article describes a practical way to keep that growth under control: treat UI as a **presentation system**, organize it by lifecycle, and keep business decisions outside it.

## The Failure Mode: the "Everything Button"

A familiar anti-pattern is a button callback that simultaneously:

- closes a result screen;
- opens the home screen;
- stops or starts gameplay;
- plays music;
- changes player data; and
- writes a save file.

None of these responsibilities are inherently related. They happen to occur after one click, but that does not make the UI button their rightful owner. Once this pattern spreads, changing navigation means reasoning about gameplay, audio, persistence, and UI at the same time.

The architectural boundary is simple:

> UI decides **how something is presented**. Business flow decides **why it should be presented**.

For example, a training-completion service may decide that a completion dialog should be shown. The UI system loads it, places it on the correct layer, plays its opening animation, and later disposes of it. The UI manager should not calculate scores, grant rewards, or save training progress.

## One UI Entry Point, Several Lifecycle Policies

`UIManager` should be a façade for UI infrastructure, not a god object. It is a useful single entry point for callers, while internally delegating to managers with different lifetime rules.

```text
UIManager
├── ScreenManager     Full-screen, mutually exclusive views
├── PopupManager      Modal views with stack navigation
├── ToastManager      Short-lived notices with queue scheduling
└── HudManager        Persistent widgets and overlays
```

Whether these are child GameObjects under a `UIManager` root or plain C# services is an implementation choice. The important part is that a caller does not instantiate arbitrary prefabs or invent a new lifecycle policy for every feature.

## 1. Screens: Replacement, Not Accumulation

A **Screen** is a primary, full-screen destination: Home, Gameplay, Inventory, Shop, or a role-specific dashboard.

Its rule is mutual exclusion: normally one primary screen is visible at a time. Opening a new screen replaces the old screen after the required transition.

```csharp
UIManager.Instance.OpenScreen<TrainingDashboardScreen>(viewModel);
```

A screen manager owns resource loading, canvas ordering, enter/exit animation, and cleanup. It does *not* decide whether a user is allowed to open the dashboard. That permission belongs to the application flow, authentication service, or domain service.

## 2. Popups: a Stack for Modal Navigation

A **Popup** is a modal interruption or short workflow: Settings, Confirm Delete, Reward Details, or Change Password.

Popups should use a **stack**, not hard-coded back-navigation:

```text
Dashboard
  └─ Settings popup
       └─ Confirm-reset popup

Close Confirm-reset → Settings becomes visible again
Close Settings      → Dashboard remains
```

```csharp
UIManager.Instance.PushPopup<SettingsPopup>(settingsVm);
UIManager.Instance.PushPopup<ConfirmResetPopup>(confirmVm);
UIManager.Instance.PopPopup();
```

The confirmation popup does not need to know that it was opened from Settings. `PopupManager` knows the stack order. This prevents a growing web of "when I close, reopen this specific panel" dependencies.

## 3. Toasts: a Queue for Short-Lived Messages

A **Toast** is an ephemeral notice: "Progress saved", "Network unavailable", or "Achievement unlocked". It should not participate in screen replacement or popup navigation.

Toasts normally use a **first-in, first-out queue**:

```text
Show A → A animates and expires → Show B → Show C
```

```csharp
UIManager.Instance.ShowToast("Progress saved");
```

This policy solves common production bugs: two messages overlapping, a message being cut off by a later message, or different systems creating floating-message prefabs without awareness of each other. The toast manager may also add rules such as duplicate suppression, priority notices, or a maximum queue length.

## 4. HUDs and Widgets: Persistent, Data-Driven UI

A **HUD** or **Widget** remains visible across a longer context, or is embedded inside another panel. Examples include a player header, a health bar, a network indicator, and a persistent training-progress widget.

These components should not be recreated for every screen transition. Their main job is to observe a small, well-defined display state and refresh when that state changes.

```csharp
hud.Refresh(new PlayerHeaderViewModel(displayName, avatar, level));
```

## A Small, Consistent Panel Contract

Each panel should expose a small lifecycle contract instead of a collection of feature-specific entry points.

```csharp
public interface IPanel<in TViewModel>
{
    void Open(TViewModel viewModel);
    void Refresh(TViewModel viewModel);
    void Close();
}
```

- `Open` receives the complete data needed for initial rendering.
- `Refresh` redraws the view when its display state changes.
- `Close` releases listeners, animations, and transient resources.

The panel should not search through global managers, query a database, or issue network requests merely to populate itself. Those actions make the panel difficult to test, difficult to reuse, and tightly coupled to its current data source.

## Read and Write Must Take Different Paths

A presentation layer can request an action, but it should not directly mutate domain data.

```text
Button click
  → Service receives an intention
  → Service validates and changes domain state
  → Service returns a result or emits new state
  → UI maps it to display data and renders feedback
```

For example, a "Submit Training Attempt" button may call a training service. The service validates the attempt, saves it locally or sends it to the backend, and returns success or a meaningful error. The UI then displays a toast, error popup, or refreshed progress view.

The distinction matters even in an offline game. Moving validation, persistence, scoring, inventory updates, and backend communication into non-`MonoBehaviour` services makes those rules independently testable and prevents UI screens from becoming accidental business controllers.

## Model Is Not View Model

Domain data is optimized for rules and storage:

```text
courseId, completedAtUtc, score, attempts
```

UI needs display-ready information:

```text
"Brake System Fundamentals", "Completed", "86%", progressColor, isLocked
```

The conversion belongs in a mapping layer that produces a **View Model**. A panel then receives only what it needs to render.

```text
Domain model / API DTO
        ↓
View-model mapper
        ↓
CourseCardViewModel
        ↓
Course-card UI renders it
```

This avoids every list item independently loading configuration, formatting dates, selecting colors, and deciding red-dot or lock states. When the display rule changes, it changes in one place.

## A Practical Adoption Strategy

An existing Unity project does not need a risky rewrite to benefit from this architecture.

1. **Stop direct prefab instantiation in new feature code.** Route new screens, popups, and notices through one UI entry point.
2. **Fix the highest-pain lifecycle first.** If floating messages overlap, introduce a queued `ToastManager` before redesigning every page.
3. **Keep new network and persistence calls behind services.** A screen should call an application-facing service, not build HTTP requests itself.
4. **Introduce View Models at feature boundaries.** Start with complex lists and dashboards, where repeated formatting and state decisions already exist.
5. **Refactor old screens gradually.** Preserve working UI while enforcing the new rule for new work.

The goal is not to maximize the number of managers or interfaces. It is to give each kind of UI a lifecycle that matches its actual behavior, and to make the dependency direction predictable:

```text
UI → application/service layer → domain data / persistence / backend
```

When that direction is protected, changing a visual layout does not threaten business rules, changing a backend implementation does not require rewriting panels, and new team members can quickly identify which layer owns a problem. That is the real transition from a collection of screens to a maintainable UI system.

---

*This article is a technical interpretation and summary of a Chinese game-UI architecture video, focused on applying its ideas to practical Unity development.*
