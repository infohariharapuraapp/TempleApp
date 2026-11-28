/**
 * Gallery CDN optimization.
 * Original URLs remain unchanged for sharing and downloading.
 * No credentials are stored here.
 */
type GalleryImageMapping = {
  id: number;
  original_url: string;
  cloudinary_url: string;
};
const galleryMappings: GalleryImageMapping[] = [
    {
        "id":  24,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/18.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839567/gallery_24.jpg"
    },
    {
        "id":  20,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/14.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839708/gallery_20.jpg"
    },
    {
        "id":  19,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/13.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839708/gallery_19.jpg"
    },
    {
        "id":  17,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/11.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839707/gallery_17.jpg"
    },
    {
        "id":  16,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/10.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839708/gallery_16.jpg"
    },
    {
        "id":  15,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/9.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839706/gallery_15.jpg"
    },
    {
        "id":  13,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/7.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839706/gallery_13.jpg"
    },
    {
        "id":  12,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/6.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839706/gallery_12.jpg"
    },
    {
        "id":  26,
        "original_url":  "https://i0.wp.com/hegdetravelphotos.com/wp-content/uploads/2023/09/20230903_101018-EDIT1_wm.jpg?resize=768%2C1024\u0026ssl=1",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839707/gallery_26.jpg"
    },
    {
        "id":  18,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/12.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839708/gallery_18.jpg"
    },
    {
        "id":  14,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/8.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839706/gallery_14.jpg"
    },
    {
        "id":  7,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/3.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839703/gallery_7.jpg"
    },
    {
        "id":  27,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/17.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839714/gallery_27.jpg"
    },
    {
        "id":  11,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/5.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839705/gallery_11.jpg"
    },
    {
        "id":  10,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/6.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839705/gallery_10.jpg"
    },
    {
        "id":  8,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/4.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839704/gallery_8.jpg"
    },
    {
        "id":  6,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/2.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839714/gallery_6.jpg"
    },
    {
        "id":  5,
        "original_url":  "https://www.divyakshetrahariharapura.com/web/assets/img/others/7.jpg",
        "cloudinary_url":  "https://res.cloudinary.com/iprkxmjn/image/upload/v1795839714/gallery_5.jpg"
    }
];
const imageMappings = new Map(
  galleryMappings.map(item => [item.id, item])
);
const CLOUDINARY_PREFIX =
  'https://res.cloudinary.com/iprkxmjn/image/upload/';
export function getOptimizedGalleryImage(
  id: number,
  originalUrl: string,
  mode: 'thumbnail' | 'viewer'
): string {
  if (!originalUrl) {
    return originalUrl;
  }
  const mapping = imageMappings.get(id);
  const source =
    mapping && mapping.original_url === originalUrl
      ? mapping.cloudinary_url
      : originalUrl;
  if (!source.startsWith(CLOUDINARY_PREFIX)) {
    return originalUrl;
  }
  const path = source.slice(CLOUDINARY_PREFIX.length);
  if (
    !/^v[0-9]+\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(jpg|jpeg|png|webp)$/i.test(path)
  ) {
    return originalUrl;
  }
  const width = mode === 'thumbnail' ? 480 : 1600;
  const transformation =
    `c_limit,w_${width},h_${width},q_auto:good,f_auto`;
  return `${CLOUDINARY_PREFIX}${transformation}/${path}`;
}