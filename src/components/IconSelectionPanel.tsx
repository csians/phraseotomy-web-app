import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Briefcase, Home, Plane, Bike, Wine, Rocket, Skull, Sparkles,
  Coffee, Users, Clock, Crown, Mail, TrendingUp, Dog, Flower,
  Sofa, Utensils, Mountain, Camera, Compass, Map, Umbrella,
  Sun, Heart, Star, Music, Book, Gift, Lightbulb, Palette,
  Gamepad2, Headphones, Smartphone, Laptop, Watch, Glasses,
  Shirt, ShoppingBag, Car, Bus, Train, Anchor, Building,
  TreePine, Cloud, Zap, Moon, Flame, Droplet, Leaf, Bug,
  Fish, Bird, Cat, Rabbit, GripVertical, Volume2, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  home: Home,
  plane: Plane,
  bike: Bike,
  wine: Wine,
  rocket: Rocket,
  skull: Skull,
  sparkles: Sparkles,
  coffee: Coffee,
  users: Users,
  clock: Clock,
  crown: Crown,
  mail: Mail,
  "trending-up": TrendingUp,
  dog: Dog,
  flower: Flower,
  sofa: Sofa,
  utensils: Utensils,
  mountain: Mountain,
  camera: Camera,
  compass: Compass,
  map: Map,
  umbrella: Umbrella,
  sun: Sun,
  heart: Heart,
  star: Star,
  music: Music,
  book: Book,
  gift: Gift,
  lightbulb: Lightbulb,
  palette: Palette,
  gamepad2: Gamepad2,
  headphones: Headphones,
  smartphone: Smartphone,
  laptop: Laptop,
  watch: Watch,
  glasses: Glasses,
  shirt: Shirt,
  "shopping-bag": ShoppingBag,
  car: Car,
  bus: Bus,
  train: Train,
  anchor: Anchor,
  building: Building,
  "tree-pine": TreePine,
  cloud: Cloud,
  zap: Zap,
  moon: Moon,
  flame: Flame,
  droplet: Droplet,
  leaf: Leaf,
  bug: Bug,
  fish: Fish,
  bird: Bird,
  cat: Cat,
  rabbit: Rabbit,
};

export interface IconItem {
  id: string;
  name: string;
  icon: string;
  isFromCore: boolean;
}

interface SortableIconProps {
  icon: IconItem;
  isDraggable: boolean;
  index: number;
}

function SortableIcon({ icon, isDraggable, index }: SortableIconProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: icon.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const IconComponent = iconMap[icon.icon] || Sparkles;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
        isDragging 
          ? "bg-primary/20 border-primary shadow-lg scale-105" 
          : "bg-card border-border hover:border-primary/50",
        icon.isFromCore && "ring-2 ring-offset-2 ring-primary/30",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 p-1 rounded-md bg-muted/50 hover:bg-muted"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
      
      <div className="text-xs text-muted-foreground font-medium">
        {index + 1}
      </div>
      
      <div className={cn(
        "h-16 w-16 rounded-full flex items-center justify-center",
        icon.isFromCore ? "bg-primary/10" : "bg-secondary/50"
      )}>
        <IconComponent className={cn(
          "h-8 w-8",
          icon.isFromCore ? "text-primary" : "text-foreground"
        )} />
      </div>
      
      <span className="text-sm font-medium text-center">{icon.name}</span>
      
      {icon.isFromCore && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          Core
        </span>
      )}
    </div>
  );
}

interface IconSelectionPanelProps {
  icons: IconItem[];
  onOrderChange?: (newOrder: IconItem[]) => void;
  isDraggable?: boolean;
  showLabel?: boolean;
  label?: string;
}

export function IconSelectionPanel({
  icons,
  onOrderChange,
  isDraggable = false,
  showLabel = true,
  label = "Story Icons",
}: IconSelectionPanelProps) {
  const [orderedIcons, setOrderedIcons] = useState<IconItem[]>(icons);

  useEffect(() => {
    setOrderedIcons(icons);
  }, [icons]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedIcons((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        onOrderChange?.(newOrder);
        return newOrder;
      });
    }
  };

  if (orderedIcons.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No icons available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showLabel && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{label}</h3>
          {isDraggable && (
            <span className="text-sm text-muted-foreground">
              Drag to reorder
            </span>
          )}
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedIcons.map((i) => i.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-wrap gap-4 justify-center">
            {orderedIcons.map((icon, index) => (
              <SortableIcon
                key={icon.id}
                icon={icon}
                isDraggable={isDraggable}
                index={index}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-primary/30" />
          <span>Core icons (from base themes)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-secondary/50" />
          <span>Theme icons</span>
        </div>
      </div>
    </div>
  );
}
