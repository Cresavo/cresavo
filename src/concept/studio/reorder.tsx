import { useId, useRef, type ReactNode } from "react";
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, pointerWithin, TouchSensor,
  useSensor, useSensors, type CollisionDetection, type Modifier, type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { t } from "../i18n";
import { IconButton } from "../ui/button";
import { cx } from "../ui/cx";

// Touch must reach the delayed sensor even on devices that also emit pointer events.
class NonTouchPointerSensor extends PointerSensor {
  static activators = PointerSensor.activators.map(({ eventName, handler }) => ({
    eventName,
    handler: (...args: Parameters<typeof handler>) => args[0].pointerType !== "touch" && handler(...args),
  }));
}

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });
const collisions: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args);
  const targets = pointerWithin(args);
  // Keep the item under the pointer in gaps and outside the list, without a destination to drop onto.
  return targets.length ? targets : [{ id: args.active.id }];
};

interface ReorderListProps<Item> {
  items: Item[];
  onReorder: (items: Item[], moved: Item) => void;
  children: ReactNode;
  enabled?: boolean;
}

/** A separate context for each list keeps drag and keyboard targets within that list. */
export function ReorderList<Item extends { id: string; name: string }>({ items, onReorder, children, enabled = true }: ReorderListProps<Item>) {
  const contextId = useId();
  const announcedTarget = useRef<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(NonTouchPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, scrollBehavior: "auto" }),
  );
  if (!enabled) return children;

  const ids = items.map((item) => item.id);
  const indexOf = (id: UniqueIdentifier) => items.findIndex((item) => item.id === id);
  const nameOf = (id: UniqueIdentifier) => items[indexOf(id)]?.name ?? String(id);

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={collisions}
      modifiers={[verticalOnly]}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const from = indexOf(active.id);
        const to = indexOf(over.id);
        if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to), items[from]);
      }}
      accessibility={{
        screenReaderInstructions: { draggable: t("reorder.instructions") },
        announcements: {
          onDragStart: ({ active }) => {
            announcedTarget.current = active.id;
            return t("reorder.pickedUp", { name: nameOf(active.id), position: indexOf(active.id) + 1, count: items.length });
          },
          onDragOver: ({ active, over }) => {
            const target = over?.id ?? null;
            if (announcedTarget.current === target) return;
            announcedTarget.current = target;
            return target === null
              ? t("reorder.outside", { name: nameOf(active.id) })
              : t("reorder.position", { name: nameOf(active.id), position: indexOf(target) + 1, count: items.length });
          },
          onDragEnd: ({ active, over }) => over
            ? t("reorder.dropped", { name: nameOf(active.id), position: indexOf(over.id) + 1, count: items.length })
            : t("reorder.cancelled", { name: nameOf(active.id) }),
          onDragCancel: ({ active }) => t("reorder.cancelled", { name: nameOf(active.id) }),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface ReorderItemProps {
  id: string;
  name: string;
  children: (handle: ReactNode) => ReactNode;
  as?: "div" | "li";
  className?: string;
  enabled?: boolean;
}

export function ReorderItem({ id, name, children, as: Tag = "div", className, enabled = true }: ReorderItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver, activeIndex, index } =
    useSortable({ id, disabled: { draggable: !enabled, droppable: !enabled } });
  const dropEdge = isOver && activeIndex !== index ? (index < activeIndex ? "top" : "bottom") : undefined;
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <Tag ref={setNodeRef} className="relative">
      <div
        className={cx("relative motion-reduce:!transition-none", isDragging && "z-20 rounded-md bg-surface shadow-sheet shadow-black/15 ring-1 ring-border", className)}
        style={style}
        data-dragging={isDragging || undefined}
      >
        {children(enabled && (
          <IconButton
            {...attributes}
            {...listeners}
            ref={setActivatorNodeRef}
            label={t("reorder.handle", { name })}
            className={cx("shrink-0 select-none touch-auto", isDragging ? "!cursor-grabbing" : "!cursor-grab")}
          >
            <GripVertical size={18} aria-hidden />
          </IconButton>
        ))}
      </div>
      {dropEdge && (
        <span
          aria-hidden
          data-drop-edge={dropEdge}
          className={cx("pointer-events-none absolute inset-x-2 z-30 h-0.5 rounded-full bg-action motion-reduce:!transition-none", dropEdge === "top" ? "top-0" : "bottom-0")}
          style={style}
        />
      )}
    </Tag>
  );
}
