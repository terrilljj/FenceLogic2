import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PathMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  availablePaths: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PathMultiSelect({
  value = [],
  onChange,
  availablePaths,
  placeholder = "Select paths...",
  disabled = false,
  className,
}: PathMultiSelectProps) {
  const [open, setOpen] = useState(false);

  // Identify unknown paths (legacy values not in canonical list)
  const unknownPaths = value.filter(path => !availablePaths.includes(path));
  const knownPaths = value.filter(path => availablePaths.includes(path));

  const handleSelect = (path: string) => {
    const isSelected = value.includes(path);
    if (isSelected) {
      onChange(value.filter(v => v !== path));
    } else {
      onChange([...value, path]);
    }
  };

  const handleRemove = (path: string) => {
    onChange(value.filter(v => v !== path));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-9 font-mono text-xs"
            disabled={disabled}
            data-testid="button-path-multiselect"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {value.length === 0 ? (
                <span className="text-muted-foreground font-normal">{placeholder}</span>
              ) : (
                <>
                  {knownPaths.map(path => (
                    <Badge
                      key={path}
                      variant="secondary"
                      className="text-xs font-mono"
                    >
                      {path}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(path);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {unknownPaths.map(path => (
                    <Badge
                      key={path}
                      variant="destructive"
                      className="text-xs font-mono"
                    >
                      {path} (unknown)
                      <button
                        className="ml-1 hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(path);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search paths..." className="h-9" />
            <CommandEmpty>No paths found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {availablePaths.map((path) => (
                <CommandItem
                  key={path}
                  value={path}
                  onSelect={() => handleSelect(path)}
                  className="font-mono text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(path) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {path}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">From catalog</p>
    </div>
  );
}
