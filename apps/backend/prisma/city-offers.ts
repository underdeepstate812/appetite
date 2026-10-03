import { OfferCategory } from "@prisma/client";

/**
 * Городская витрина: 40 разных предложений по районам Санкт-Петербурга — карта выглядит живым городом, а не
 * кучкой точек у центра. Координаты получены геокодером по адресам (Nominatim/OpenStreetMap) и зашиты как
 * константы: сид не ходит в сеть. Названия заведений вымышленные (бета, тестовые данные), адреса — настоящие улицы.
 *
 * JoyPizza (Искровский проспект, 40) — «горячее предложение дня»: featured = true, скидка 70% и окно 24 часа,
 * см. поле Offer.featured. Остальные офферы горят по общему правилу — от оставшегося времени.
 */

const { FOOD, BAKERY, FLOWERS, GROCERIES } = OfferCategory;

function unsplash(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=75`;
}

export interface CityOffer {
  district: string;
  shop: string;
  address: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: OfferCategory;
  originalPriceRub: number;
  /** Желаемая итоговая скидка, %: стартовая подбирается так, чтобы с надбавкой за время получилось это число. */
  targetDiscount: number;
  hoursToEnd: number;
  quantityTotal: number;
  weightKg: number;
  /** Файл из prisma/seed-images либо готовый URL; без картинки витрина покажет плашку категории. */
  image?: { file: string } | { url: string };
  featured?: boolean;
}

export const CITY_OFFERS: CityOffer[] = [
  {
    district: "Невский", shop: "JoyPizza", address: "Искровский проспект, 40, Санкт-Петербург", lat: 59.89522, lng: 30.47775,
    title: "Пицца «Маргарита» + «Пепперони», 2 шт", description: "Две свежие 30-сантиметровые пиццы JoyPizza — горячее предложение дня.", category: FOOD, originalPriceRub: 1190, targetDiscount: 70,
    hoursToEnd: 24, quantityTotal: 12, weightKg: 0.9, image: { file: "pizza-pepperoni.jpg" }, featured: true,
  },
  {
    district: "Центральный", shop: "Борщ & Ко", address: "Лиговский проспект, 50, Санкт-Петербург", lat: 59.92324, lng: 30.36088,
    title: "Борщ со сметаной и пампушками", description: "Наваристый борщ на говяжьем бульоне, пампушки с чесноком.", category: FOOD, originalPriceRub: 420, targetDiscount: 45,
    hoursToEnd: 4.5, quantityTotal: 8, weightKg: 0.5, image: undefined,
  },
  {
    district: "Центральный", shop: "Пельменная №1", address: "Гороховая улица, 30, Санкт-Петербург", lat: 59.9299, lng: 30.32055,
    title: "Пельмени ручной лепки, 500 г", description: "Классические пельмени со свининой и говядиной, подаются со сметаной.", category: FOOD, originalPriceRub: 480, targetDiscount: 50,
    hoursToEnd: 6, quantityTotal: 10, weightKg: 0.5, image: undefined,
  },
  {
    district: "Центральный", shop: "Блинная на Садовой", address: "Садовая улица, 28-30, Санкт-Петербург", lat: 59.9306, lng: 30.32756,
    title: "Блины с красной икрой и сёмгой", description: "Тонкие блины, слабосолёная сёмга, красная икра.", category: FOOD, originalPriceRub: 690, targetDiscount: 55,
    hoursToEnd: 5, quantityTotal: 6, weightKg: 0.35, image: undefined,
  },
  {
    district: "Центральный", shop: "Пирожковая у Рубинштейна", address: "улица Рубинштейна, 20, Санкт-Петербург", lat: 59.92999, lng: 30.34503,
    title: "Пирожки с капустой и яйцом, 5 шт", description: "Печёные пирожки с домашней начинкой, ещё тёплые.", category: BAKERY, originalPriceRub: 300, targetDiscount: 50,
    hoursToEnd: 3.5, quantityTotal: 12, weightKg: 0.4, image: undefined,
  },
  {
    district: "Центральный", shop: "Столовая на Невском", address: "Невский проспект, 100, Санкт-Петербург", lat: 59.9321, lng: 30.3555,
    title: "Бизнес-ланч: суп и горячее", description: "Суп дня, горячее с гарниром и компот.", category: FOOD, originalPriceRub: 520, targetDiscount: 40,
    hoursToEnd: 2.4, quantityTotal: 15, weightKg: 0.7, image: undefined,
  },
  {
    district: "Адмиралтейский", shop: "Кофе-бар Измайловский", address: "Измайловский проспект, 14, Санкт-Петербург", lat: 59.90899, lng: 30.30744,
    title: "Кофе и круассан с миндалём", description: "Капучино и свежий круассан с миндальным кремом.", category: FOOD, originalPriceRub: 360, targetDiscount: 55,
    hoursToEnd: 3, quantityTotal: 10, weightKg: 0.3, image: { file: "cappuccino.jpg" },
  },
  {
    district: "Адмиралтейский", shop: "Цветочная лавка на Садовой", address: "Садовая улица, 55, Санкт-Петербург", lat: 59.92759, lng: 30.32873,
    title: "Сборный букет «Лето»", description: "Сезонные цветы в крафтовой упаковке.", category: FLOWERS, originalPriceRub: 1700, targetDiscount: 45,
    hoursToEnd: 5, quantityTotal: 4, weightKg: 0.6, image: { url: unsplash("photo-1487070183336-b863922373d4") },
  },
  {
    district: "Василеостровский", shop: "Столовая №57", address: "Большой проспект В.О., 55, Санкт-Петербург", lat: 59.93653, lng: 30.27169,
    title: "Солянка сборная мясная", description: "Густая солянка с копчёностями, лимоном и маслинами.", category: FOOD, originalPriceRub: 380, targetDiscount: 45,
    hoursToEnd: 4, quantityTotal: 8, weightKg: 0.45, image: undefined,
  },
  {
    district: "Василеостровский", shop: "Суши Мастер", address: "6-я линия В.О., 31, Санкт-Петербург", lat: 59.94379, lng: 30.27826,
    title: "Ролл «Калифорния», 8 шт", description: "Краб, авокадо, огурец, икра тобико.", category: FOOD, originalPriceRub: 640, targetDiscount: 50,
    hoursToEnd: 3, quantityTotal: 8, weightKg: 0.35, image: { file: "sushi-philadelphia.jpg" },
  },
  {
    district: "Василеостровский", shop: "Хлеб Насущный", address: "улица Беринга, 1, Санкт-Петербург", lat: 59.94455, lng: 30.23918,
    title: "Бородинский хлеб и батон", description: "Ржаной бородинский хлеб на закваске и пшеничный батон.", category: BAKERY, originalPriceRub: 260, targetDiscount: 50,
    hoursToEnd: 2.6, quantityTotal: 14, weightKg: 0.8, image: { url: unsplash("photo-1509440159596-0249088772ff") },
  },
  {
    district: "Петроградский", shop: "Салат-бар «Лето»", address: "Каменноостровский проспект, 42, Санкт-Петербург", lat: 59.96758, lng: 30.3093,
    title: "Оливье и «Сельдь под шубой»", description: "Два фирменных салата по рецепту «как дома».", category: FOOD, originalPriceRub: 410, targetDiscount: 45,
    hoursToEnd: 5, quantityTotal: 9, weightKg: 0.6, image: undefined,
  },
  {
    district: "Петроградский", shop: "Рамен-бар Токио", address: "Большой проспект П.С., 50, Санкт-Петербург", lat: 59.96199, lng: 30.30592,
    title: "Рамен с мисо и свининой", description: "Насыщенный бульон мисо, лапша, свинина чашу, яйцо.", category: FOOD, originalPriceRub: 620, targetDiscount: 50,
    hoursToEnd: 3.8, quantityTotal: 6, weightKg: 0.55, image: undefined,
  },
  {
    district: "Петроградский", shop: "Cantina", address: "улица Ленина, 20, Санкт-Петербург", lat: 59.96196, lng: 30.30419,
    title: "Тако с говядиной, 3 шт", description: "Мягкие лепёшки, говядина, пико-де-гайо и лайм.", category: FOOD, originalPriceRub: 540, targetDiscount: 45,
    hoursToEnd: 4.2, quantityTotal: 7, weightKg: 0.4, image: undefined,
  },
  {
    district: "Петроградский", shop: "Éclair", address: "Большая Монетная улица, 16, Санкт-Петербург", lat: 59.96262, lng: 30.32061,
    title: "Эклеры ассорти, 6 шт", description: "Ванильный, шоколадный и фисташковый эклеры.", category: BAKERY, originalPriceRub: 540, targetDiscount: 55,
    hoursToEnd: 3.2, quantityTotal: 8, weightKg: 0.4, image: { url: unsplash("photo-1488477181946-6428a0291777") },
  },
  {
    district: "Крестовский остров", shop: "Пекарня «Кулебяка»", address: "Морской проспект, 29, Санкт-Петербург", lat: 59.97184, lng: 30.26352,
    title: "Кулебяка с лососем", description: "Слоёный пирог с лососем, рисом и зеленью.", category: BAKERY, originalPriceRub: 780, targetDiscount: 50,
    hoursToEnd: 6, quantityTotal: 5, weightKg: 0.7, image: undefined,
  },
  {
    district: "Выборгский", shop: "Домашняя кухня", address: "Лесной проспект, 65, Санкт-Петербург", lat: 59.98605, lng: 30.34236,
    title: "Котлеты по-киевски с пюре", description: "Куриные котлеты с маслом внутри и картофельное пюре.", category: FOOD, originalPriceRub: 450, targetDiscount: 50,
    hoursToEnd: 4.6, quantityTotal: 9, weightKg: 0.5, image: undefined,
  },
  {
    district: "Выборгский", shop: "Burger Lab", address: "Большой Сампсониевский проспект, 60, Санкт-Петербург", lat: 59.9741, lng: 30.3383,
    title: "Бургер с курицей и фри", description: "Хрустящая курица, соус, овощи и порция фри.", category: FOOD, originalPriceRub: 490, targetDiscount: 45,
    hoursToEnd: 3.4, quantityTotal: 8, weightKg: 0.5, image: { file: "burger.jpg" },
  },
  {
    district: "Выборгский", shop: "Мангал-Хаус", address: "проспект Энгельса, 33, Санкт-Петербург", lat: 60.00972, lng: 30.3262,
    title: "Шашлык куриный с лавашем", description: "Маринованное бедро на мангале, лаваш, лук и соус.", category: FOOD, originalPriceRub: 520, targetDiscount: 50,
    hoursToEnd: 5.5, quantityTotal: 8, weightKg: 0.45, image: undefined,
  },
  {
    district: "Калининский", shop: "Тбилиси", address: "Гражданский проспект, 41, Санкт-Петербург", lat: 60.01204, lng: 30.39887,
    title: "Хинкали, 8 шт", description: "Сочные хинкали с говядиной и свининой.", category: FOOD, originalPriceRub: 560, targetDiscount: 55,
    hoursToEnd: 4.8, quantityTotal: 6, weightKg: 0.6, image: undefined,
  },
  {
    district: "Калининский", shop: "Здоровая кухня", address: "проспект Науки, 17, Санкт-Петербург", lat: 60.01506, lng: 30.38443,
    title: "Гречка с грибами и курицей", description: "Гречневая каша с шампиньонами и куриной грудкой.", category: FOOD, originalPriceRub: 380, targetDiscount: 45,
    hoursToEnd: 6.5, quantityTotal: 10, weightKg: 0.45, image: undefined,
  },
  {
    district: "Калининский", shop: "Ферма Рядом", address: "Бестужевская улица, 27, Санкт-Петербург", lat: 59.98286, lng: 30.40764,
    title: "Набор молочных продуктов", description: "Молоко, кефир, творог и сметана с местной фермы.", category: GROCERIES, originalPriceRub: 520, targetDiscount: 50,
    hoursToEnd: 7, quantityTotal: 8, weightKg: 1.8, image: { url: unsplash("photo-1542838132-92c53300491e") },
  },
  {
    district: "Красногвардейский", shop: "Чайхана Самарканд", address: "Индустриальный проспект, 24, Санкт-Петербург", lat: 59.94613, lng: 30.47416,
    title: "Плов с бараниной", description: "Рассыпчатый плов с бараниной, морковью и зирой.", category: FOOD, originalPriceRub: 480, targetDiscount: 50,
    hoursToEnd: 5, quantityTotal: 9, weightKg: 0.55, image: undefined,
  },
  {
    district: "Красногвардейский", shop: "Pasta Nostra", address: "Среднеохтинский проспект, 44, Санкт-Петербург", lat: 59.95662, lng: 30.41492,
    title: "Паста болоньезе", description: "Спагетти с мясным соусом и пармезаном.", category: FOOD, originalPriceRub: 450, targetDiscount: 45,
    hoursToEnd: 3.9, quantityTotal: 8, weightKg: 0.4, image: undefined,
  },
  {
    district: "Красногвардейский", shop: "Овощная база", address: "Новочеркасский проспект, 51, Санкт-Петербург", lat: 59.92416, lng: 30.41621,
    title: "Сезонный ящик овощей и фруктов", description: "Свежие овощи и фрукты, собранные в ящик дня.", category: GROCERIES, originalPriceRub: 900, targetDiscount: 55,
    hoursToEnd: 8, quantityTotal: 6, weightKg: 4.0, image: { url: unsplash("photo-1542838132-92c53300491e") },
  },
  {
    district: "Невский", shop: "Шашлычный двор", address: "проспект Обуховской Обороны, 110, Санкт-Петербург", lat: 59.8677, lng: 30.46981,
    title: "Шашлык из свинины с овощами", description: "Шейка на мангале с запечёнными овощами.", category: FOOD, originalPriceRub: 640, targetDiscount: 50,
    hoursToEnd: 4, quantityTotal: 7, weightKg: 0.5, image: undefined,
  },
  {
    district: "Невский", shop: "Хлебный дом", address: "проспект Большевиков, 5, Санкт-Петербург", lat: 59.90613, lng: 30.48967,
    title: "Ватрушки с творогом, 4 шт", description: "Мягкие ватрушки с творожной начинкой.", category: BAKERY, originalPriceRub: 280, targetDiscount: 50,
    hoursToEnd: 3.6, quantityTotal: 12, weightKg: 0.45, image: undefined,
  },
  {
    district: "Невский", shop: "Вареничная", address: "улица Дыбенко, 25, Санкт-Петербург", lat: 59.90424, lng: 30.47681,
    title: "Вареники с картошкой и грибами", description: "Домашние вареники, сметана и жареный лук.", category: FOOD, originalPriceRub: 360, targetDiscount: 50,
    hoursToEnd: 4.4, quantityTotal: 10, weightKg: 0.5, image: undefined,
  },
  {
    district: "Фрунзенский", shop: "Суп-Бар", address: "Бухарестская улица, 30, Санкт-Петербург", lat: 59.88374, lng: 30.3693,
    title: "Крем-суп из тыквы с гренками", description: "Нежный тыквенный крем-суп со сливками.", category: FOOD, originalPriceRub: 320, targetDiscount: 45,
    hoursToEnd: 5.2, quantityTotal: 10, weightKg: 0.4, image: undefined,
  },
  {
    district: "Фрунзенский", shop: "Бабушкина кухня", address: "Загребский бульвар, 9, Санкт-Петербург", lat: 59.84486, lng: 30.3967,
    title: "Голубцы с соусом, 3 шт", description: "Голубцы с рисом и мясом в сметанно-томатном соусе.", category: FOOD, originalPriceRub: 400, targetDiscount: 50,
    hoursToEnd: 4.1, quantityTotal: 8, weightKg: 0.5, image: undefined,
  },
  {
    district: "Фрунзенский", shop: "Торты от Нади", address: "Дунайский проспект, 20, Санкт-Петербург", lat: 59.83145, lng: 30.34615,
    title: "Медовик, 2 куска", description: "Медовый торт на сметанном креме.", category: BAKERY, originalPriceRub: 420, targetDiscount: 55,
    hoursToEnd: 3.7, quantityTotal: 6, weightKg: 0.35, image: { url: unsplash("photo-1488477181946-6428a0291777") },
  },
  {
    district: "Московский", shop: "Silk Road", address: "Московский проспект, 200, Санкт-Петербург", lat: 59.86036, lng: 30.32158,
    title: "Лагман с говядиной", description: "Тянутая лапша, говядина, овощи, наваристый бульон.", category: FOOD, originalPriceRub: 470, targetDiscount: 50,
    hoursToEnd: 5.4, quantityTotal: 7, weightKg: 0.55, image: undefined,
  },
  {
    district: "Московский", shop: "Завтрак весь день", address: "Новоизмайловский проспект, 22, Санкт-Петербург", lat: 59.86187, lng: 30.30631,
    title: "Сырники со сметаной и ягодами", description: "Творожные сырники, сметана, ягодный соус.", category: FOOD, originalPriceRub: 340, targetDiscount: 55,
    hoursToEnd: 2.8, quantityTotal: 9, weightKg: 0.35, image: undefined,
  },
  {
    district: "Московский", shop: "Цветы у метро", address: "Московский проспект, 100, Санкт-Петербург", lat: 59.89863, lng: 30.32205,
    title: "Тюльпаны, 15 шт", description: "Свежие тюльпаны в упаковке.", category: FLOWERS, originalPriceRub: 1500, targetDiscount: 50,
    hoursToEnd: 4.5, quantityTotal: 5, weightKg: 0.6, image: { url: unsplash("photo-1487070183336-b863922373d4") },
  },
  {
    district: "Кировский", shop: "Рыбная лавка «Нептун»", address: "проспект Стачек, 70, Санкт-Петербург", lat: 59.87972, lng: 30.26201,
    title: "Рыба в кляре с картофелем", description: "Хрустящая рыба в кляре, картофель и соус тартар.", category: FOOD, originalPriceRub: 520, targetDiscount: 45,
    hoursToEnd: 4.7, quantityTotal: 7, weightKg: 0.5, image: undefined,
  },
  {
    district: "Кировский", shop: "Wok&Roll", address: "проспект Ветеранов, 101, Санкт-Петербург", lat: 59.83411, lng: 30.20481,
    title: "Курица терияки с рисом", description: "Курица в соусе терияки, рис, овощи.", category: FOOD, originalPriceRub: 430, targetDiscount: 50,
    hoursToEnd: 3.3, quantityTotal: 9, weightKg: 0.5, image: undefined,
  },
  {
    district: "Кировский", shop: "Маркет «Рядом»", address: "Ленинский проспект, 100, Санкт-Петербург", lat: 59.85301, lng: 30.21925,
    title: "Бакалея: крупы и макароны, набор", description: "Гречка, рис, макароны и овсянка.", category: GROCERIES, originalPriceRub: 600, targetDiscount: 45,
    hoursToEnd: 9, quantityTotal: 8, weightKg: 2.5, image: { url: unsplash("photo-1542838132-92c53300491e") },
  },
  {
    district: "Приморский", shop: "Олива", address: "Комендантский проспект, 17, Санкт-Петербург", lat: 60.01203, lng: 30.25802,
    title: "Греческий салат с фетой", description: "Овощи, маслины, фета, оливковое масло.", category: FOOD, originalPriceRub: 390, targetDiscount: 45,
    hoursToEnd: 4.4, quantityTotal: 8, weightKg: 0.4, image: undefined,
  },
  {
    district: "Приморский", shop: "Fish Point", address: "Коломяжский проспект, 15, Санкт-Петербург", lat: 60.00164, lng: 30.29918,
    title: "Стейк из лосося с овощами", description: "Стейк лосося на гриле и овощи.", category: FOOD, originalPriceRub: 890, targetDiscount: 50,
    hoursToEnd: 3.1, quantityTotal: 5, weightKg: 0.4, image: undefined,
  },
  {
    district: "Приморский", shop: "Розарий", address: "Туристская улица, 30, Санкт-Петербург", lat: 60.00506, lng: 30.2104,
    title: "Кустовые розы, 7 шт", description: "Свежие кустовые розы разных оттенков.", category: FLOWERS, originalPriceRub: 1900, targetDiscount: 55,
    hoursToEnd: 5.8, quantityTotal: 4, weightKg: 0.5, image: { url: unsplash("photo-1487070183336-b863922373d4") },
  },
];
