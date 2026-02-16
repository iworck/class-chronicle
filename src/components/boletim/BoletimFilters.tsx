import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, SlidersHorizontal } from 'lucide-react';

interface FiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
}

export function BoletimFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou matrícula..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="CURSANDO">Cursando</SelectItem>
            <SelectItem value="APROVADO">Aprovado</SelectItem>
            <SelectItem value="REPROVADO">Reprovado</SelectItem>
            <SelectItem value="TRANCADO">Trancado</SelectItem>
            <SelectItem value="EM_RISCO">Em Risco</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name_asc">Nome A-Z</SelectItem>
          <SelectItem value="name_desc">Nome Z-A</SelectItem>
          <SelectItem value="avg_desc">Maior Média</SelectItem>
          <SelectItem value="avg_asc">Menor Média</SelectItem>
          <SelectItem value="att_desc">Maior Frequência</SelectItem>
          <SelectItem value="att_asc">Menor Frequência</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
