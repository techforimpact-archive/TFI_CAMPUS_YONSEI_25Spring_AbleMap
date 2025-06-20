import { Button } from "@/components/ui/button";
import { CategoryWithActive } from "@/types";
import { Coffee, UtensilsCrossed, ShoppingBag, Store } from "lucide-react";

interface CategoryFilterProps {
  categories: CategoryWithActive[];
  toggleCategory: (categoryId: number) => void;
}

export default function CategoryFilter({
  categories,
  toggleCategory,
}: CategoryFilterProps) {
  // 카테고리별 아이콘 매핑
  const getCategoryIcon = (key: string) => {
    switch (key) {
      case 'food': return <UtensilsCrossed size={16} />;
      case 'cafe': return <Coffee size={16} />;
      case 'shopping': return <ShoppingBag size={16} />;
      case 'convenience': return <Store size={16} />;
      default: return null;
    }
  };
  
  // 카테고리별 색상 매핑
  const getCategoryColor = (key: string, isActive: boolean) => {
    if (!isActive) return "bg-white text-gray-700 border-gray-200 hover:bg-gray-100/90";
    
    // 클릭 시 모든 카테고리 버튼은 노란색으로 변경
    return "bg-ablemap-yellow/90 text-ablemap-brown border-ablemap-yellow";
  };

  return (
    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md flex flex-row justify-center gap-2 max-w-fit">
      {categories.map((category) => (
        <Button
          key={category.id}
          variant="outline"
          size="sm"
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium border-2 transition-all ${
            getCategoryColor(category.key, category.active)
          } ${category.active ? 'scale-105 shadow-sm' : 'hover:scale-105'}`}
          onClick={() => toggleCategory(category.id)}
        >
          {getCategoryIcon(category.key)}
          <span>{category.name}</span>
        </Button>
      ))}
    </div>
  );
}
