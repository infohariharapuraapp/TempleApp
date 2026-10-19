import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';

import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiRequest,
  API_BASE_URL,
} from '@/services/api';

const {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} = Dimensions.get('window');

/* ===================================================== */
/* TYPES */
/* ===================================================== */

type GalleryItem = {
  id: number;
  title: string | null;
  description: string | null;
  image_url: string;
  category: string | null;
  album_id: number | null;
  is_active: boolean;
};

type GalleryAlbum = {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  images: GalleryItem[];
};

/* ===================================================== */
/* IMAGE URL */
/* ===================================================== */

const getImageUrl = (
  imageUrl: string,
) => {
  if (!imageUrl) {
    return '';
  }

  /*
   * Already a complete URL.
   */
  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://')
  ) {
    return imageUrl;
  }

  /*
   * API_BASE_URL:
   *
   * https://templeapp-s96e.onrender.com/api
   *
   * Image:
   *
   * /uploads/gallery/image.jpg
   *
   * Required:
   *
   * https://templeapp-s96e.onrender.com/uploads/...
   */

  const serverUrl =
    API_BASE_URL.replace(
      /\/api\/?$/,
      '',
    );

  return `${serverUrl}${
    imageUrl.startsWith('/')
      ? ''
      : '/'
  }${imageUrl}`;
};

/* ===================================================== */
/* GALLERY SCREEN */
/* ===================================================== */

export default function GalleryScreen() {
  /*
   * ===================================================
   * GALLERY DATA
   * ===================================================
   */

  /*
   * Flat gallery list.
   *
   * We retain this for general compatibility,
   * while galleryAlbums controls the new
   * heading-based UI.
   */
  const [
    galleryItems,
    setGalleryItems,
  ] = useState<GalleryItem[]>([]);

  /*
   * Dynamic headings created by Admin.
   *
   * Example:
   *
   * Temple Entrance
   *   - photo
   *   - photo
   *
   * Anjaneya Swamy
   *   - photo
   *   - photo
   */
  const [
    galleryAlbums,
    setGalleryAlbums,
  ] = useState<GalleryAlbum[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  /*
   * ===================================================
   * VIEW ALL
   * ===================================================
   */

  const [
    showAllPhotos,
    setShowAllPhotos,
  ] = useState(false);

  /*
   * Which heading is currently selected.
   */
  const [
    selectedAlbum,
    setSelectedAlbum,
  ] =
    useState<GalleryAlbum | null>(
      null,
    );

  /*
   * ===================================================
   * IMAGE VIEWER
   * ===================================================
   */

  const [
    selectedImageIndex,
    setSelectedImageIndex,
  ] =
    useState<number | null>(
      null,
    );

  const [
    imageActionLoading,
    setImageActionLoading,
  ] = useState<
    'share' | 'download' | null
  >(null);

  /*
   * ===================================================
   * LOAD GALLERY
   * ===================================================
   */

  const loadGallery =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        /*
         * New grouped gallery API.
         */
        const response =
          await apiRequest<{
            success: boolean;
            data: GalleryAlbum[];
          }>('/gallery/albums');

        if (response.success) {
          /*
           * Hide empty headings.
           *
           * If Admin creates a heading but
           * hasn't uploaded a photo yet,
           * devotees don't see an empty section.
           */
          const albumsWithImages =
            (
              response.data || []
            ).filter(
              (album) =>
                Array.isArray(
                  album.images,
                ) &&
                album.images.length >
                  0,
            );

          /*
           * Save grouped data.
           */
          setGalleryAlbums(
            albumsWithImages,
          );

          /*
           * Create flat array too.
           */
          const allImages =
            albumsWithImages.flatMap(
              (album) =>
                album.images,
            );

          setGalleryItems(
            allImages,
          );

          /*
           * If View All is currently
           * displaying an album and
           * gallery refreshes, update
           * the selected album.
           */
          setSelectedAlbum(
            (
              currentAlbum,
            ) => {
              if (
                !currentAlbum
              ) {
                return null;
              }

              return (
                albumsWithImages.find(
                  (album) =>
                    album.id ===
                    currentAlbum.id,
                ) || null
              );
            },
          );
        } else {
          setGalleryAlbums([]);
          setGalleryItems([]);
          setSelectedAlbum(
            null,
          );
        }
      } catch (err) {
        console.error(
          'Gallery loading error:',
          err,
        );

        setError(
          'Unable to load gallery',
        );

        setGalleryAlbums([]);
        setGalleryItems([]);
        setSelectedAlbum(null);
      } finally {
        setLoading(false);
      }
    }, []);

  /*
   * Initial load.
   */
  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  /*
   * Refresh every 60 seconds.
   */
  useEffect(() => {
    const interval =
      setInterval(() => {
        loadGallery();
      }, 60000);

    return () =>
      clearInterval(
        interval,
      );
  }, [loadGallery]);

  /*
   * ===================================================
   * OPEN ALBUM
   * ===================================================
   */

  const openAlbum = (
    album: GalleryAlbum,
  ) => {
    setSelectedAlbum(album);

    setSelectedImageIndex(
      null,
    );

    setShowAllPhotos(true);
  };

  /*
   * ===================================================
   * CLOSE ALBUM
   * ===================================================
   */

  const closeAlbum = () => {
    setShowAllPhotos(false);

    setSelectedImageIndex(
      null,
    );

    setSelectedAlbum(null);
  };

  /*
   * ===================================================
   * VIEWER IMAGES
   * ===================================================
   *
   * If the user opened a picture belonging
   * to one heading, previous/next should
   * stay inside that heading.
   */

  const viewerImages =
    selectedAlbum
      ? selectedAlbum.images
      : galleryItems;

  /*
   * ===================================================
   * OPEN IMAGE
   * ===================================================
   */

  const openImage = (
    index: number,
    album?: GalleryAlbum,
  ) => {
    /*
     * When opening directly from one of
     * the main-page album previews,
     * remember that album.
     */
    if (album) {
      setSelectedAlbum(
        album,
      );
    }

    setSelectedImageIndex(
      index,
    );
  };

  /*
   * ===================================================
   * CLOSE IMAGE
   * ===================================================
   */

  const closeImage = () => {
    setSelectedImageIndex(
      null,
    );

    /*
     * When the image was opened directly
     * from the main Gallery page, clear
     * the temporary album selection.
     *
     * When View All is open, retain it.
     */
    if (!showAllPhotos) {
      setSelectedAlbum(
        null,
      );
    }
  };

  /*
   * ===================================================
   * NEXT IMAGE
   * ===================================================
   */

  const nextImage = () => {
    if (
      selectedImageIndex ===
        null ||
      viewerImages.length ===
        0
    ) {
      return;
    }

    setSelectedImageIndex(
      (
        selectedImageIndex +
        1
      ) %
        viewerImages.length,
    );
  };

  /*
   * ===================================================
   * PREVIOUS IMAGE
   * ===================================================
   */

  const previousImage =
    () => {
      if (
        selectedImageIndex ===
          null ||
        viewerImages.length ===
          0
      ) {
        return;
      }

      setSelectedImageIndex(
        selectedImageIndex ===
          0
          ? viewerImages.length -
              1
          : selectedImageIndex -
              1,
      );
    };

  /*
   * ===================================================
   * CURRENT IMAGE
   * ===================================================
   */

  const selectedImage =
    selectedImageIndex !==
      null
      ? viewerImages[
          selectedImageIndex
        ]
      : null;

  /*
   * ===================================================
   * DOWNLOAD IMAGE TO TEMP FILE
   * ===================================================
   */

  const getImageFileUri =
    async (
      imageUrl: string,
    ) => {
      const remoteUrl =
        getImageUrl(
          imageUrl,
        );

      const extensionMatch =
        remoteUrl.match(
          /\.(jpg|jpeg|png|webp)(?:\?|$)/i,
        );

      const extension =
        extensionMatch?.[1]?.toLowerCase() ||
        'jpg';

      const fileName =
        `temple-gallery-${Date.now()}.${extension}`;

      const localUri =
        `${FileSystem.cacheDirectory}${fileName}`;

      const result =
        await FileSystem.downloadAsync(
          remoteUrl,
          localUri,
        );

      return result.uri;
    };

  /*
   * ===================================================
   * SHARE IMAGE
   * ===================================================
   */

  const shareSelectedImage =
    async () => {
      if (!selectedImage) {
        return;
      }

      try {
        setImageActionLoading(
          'share',
        );

        const localUri =
          await getImageFileUri(
            selectedImage.image_url,
          );

        const remoteUrl =
          getImageUrl(
            selectedImage.image_url,
          );

        const extensionMatch =
          remoteUrl.match(
            /\.(jpg|jpeg|png|webp)(?:\?|$)/i,
          );

        const extension =
          extensionMatch?.[1]?.toLowerCase() ||
          'jpg';

        const mimeType =
          extension === 'jpg' ||
          extension === 'jpeg'
            ? 'image/jpeg'
            : extension ===
                'png'
              ? 'image/png'
              : 'image/webp';

        const available =
          await Sharing.isAvailableAsync();

        if (!available) {
          throw new Error(
            'Image sharing is not available on this device.',
          );
        }

        await Sharing.shareAsync(
          localUri,
          {
            mimeType,

            dialogTitle:
              selectedImage.title ||
              'Share Temple Image',
          },
        );
      } catch (err) {
        console.error(
          'Gallery image share error:',
          err,
        );
      } finally {
        setImageActionLoading(
          null,
        );
      }
    };

  /*
   * ===================================================
   * DOWNLOAD IMAGE
   * ===================================================
   */

  const downloadSelectedImage =
    async () => {
      if (!selectedImage) {
        return;
      }

      try {
        setImageActionLoading(
          'download',
        );

        const localUri =
          await getImageFileUri(
            selectedImage.image_url,
          );

        const permission =
          await MediaLibrary.requestPermissionsAsync();

        if (
          !permission.granted
        ) {
          throw new Error(
            'Photo library permission was not granted.',
          );
        }

        await MediaLibrary.createAssetAsync(
          localUri,
        );

        console.log(
          'Gallery image saved successfully',
        );
      } catch (err) {
        console.error(
          'Gallery image download error:',
          err,
        );
      } finally {
        setImageActionLoading(
          null,
        );
      }
    };
      return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF9F0"
      />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* ============================================= */}
        {/* LOADING */}
        {/* ============================================= */}

        {loading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="large"
              color="#A85D25"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading gallery...
            </Text>
          </View>
        ) : error ? (
          /* =========================================== */
          /* ERROR */
          /* =========================================== */

          <View
            style={
              styles.emptyContainer
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Unable to load gallery
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Please check your
              internet connection and
              try again.
            </Text>

            <Pressable
              onPress={
                loadGallery
              }
              style={({
                pressed,
              }) => [
                styles.retryButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.retryText
                }
              >
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : showAllPhotos &&
          selectedAlbum ? (
          <>
            {/* ========================================= */}
            {/* SELECTED ALBUM */}
            {/* ========================================= */}

            <View
              style={
                styles.galleryHeader
              }
            >
              <Pressable
                onPress={
                  closeAlbum
                }
                style={({
                  pressed,
                }) => [
                  styles.backButton,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.backArrow
                  }
                >
                  ‹
                </Text>
              </Pressable>

              <View
                style={
                  styles.galleryHeaderText
                }
              >
                <Text
                  style={
                    styles.galleryEyebrow
                  }
                >
                  TEMPLE GALLERY
                </Text>

                <Text
                  style={
                    styles.galleryPageTitle
                  }
                >
                  {
                    selectedAlbum.name
                  }
                </Text>

                {selectedAlbum.description?.trim() ? (
                  <Text
                    style={
                      styles.galleryPageSubtitle
                    }
                    numberOfLines={
                      2
                    }
                  >
                    {
                      selectedAlbum.description
                    }
                  </Text>
                ) : (
                  <Text
                    style={
                      styles.galleryPageSubtitle
                    }
                  >
                    Explore temple
                    photographs
                  </Text>
                )}
              </View>

              <View
                style={
                  styles.photoCount
                }
              >
                <Text
                  style={
                    styles.photoCountNumber
                  }
                >
                  {
                    selectedAlbum
                      .images.length
                  }
                </Text>

                <Text
                  style={
                    styles.photoCountLabel
                  }
                >
                  PHOTOS
                </Text>
              </View>
            </View>

            {/* ========================================= */}
            {/* ALL PHOTOS IN SELECTED ALBUM */}
            {/* ========================================= */}

            <View
              style={
                styles.fullGalleryGrid
              }
            >
              {selectedAlbum.images.map(
                (
                  item,
                  index,
                ) => (
                  <View
                    key={
                      item.id
                    }
                    style={
                      styles.fullGalleryWrapper
                    }
                  >
                    <Pressable
                      onPress={() =>
                        openImage(
                          index,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.fullGalleryItem,

                        pressed &&
                          styles.galleryItemPressed,
                      ]}
                    >
                      <Image
                        source={{
                          uri: getImageUrl(
                            item.image_url,
                          ),
                        }}
                        style={
                          styles.fullGalleryImage
                        }
                        resizeMode="cover"
                      />
                    </Pressable>

                    {(item.title?.trim() ||
                      item.description?.trim()) && (
                      <View
                        style={
                          styles.galleryTextContainer
                        }
                      >
                        {item.title?.trim() ? (
                          <Text
                            style={
                              styles.fullGalleryTitle
                            }
                          >
                            {
                              item.title
                            }
                          </Text>
                        ) : null}

                        {item.description?.trim() ? (
                          <Text
                            style={
                              styles.fullGalleryDescription
                            }
                          >
                            {
                              item.description
                            }
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                ),
              )}
            </View>

            <View
              style={
                styles.galleryBottomSpace
              }
            />
          </>
        ) : (
          <>
            {/* ========================================= */}
            {/* MAIN GALLERY PAGE */}
            {/* ========================================= */}

            <View
              style={styles.header}
            >
              <View
                style={
                  styles.headerText
                }
              >
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  TEMPLE MEDIA
                </Text>

                <Text
                  style={
                    styles.title
                  }
                >
                  Gallery
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  Explore temple photos,
                  videos and devotional
                  stotras
                </Text>
              </View>
            </View>

            {/* ========================================= */}
            {/* DYNAMIC ADMIN-CREATED HEADINGS */}
            {/* ========================================= */}

            {galleryAlbums.length ===
            0 ? (
              <View
                style={
                  styles.noPhotosCard
                }
              >
                <Text
                  style={
                    styles.noPhotosTitle
                  }
                >
                  No photos available
                </Text>

                <Text
                  style={
                    styles.noPhotosText
                  }
                >
                  Temple gallery photos
                  will appear here when
                  they are added by the
                  administrator.
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.albumSectionsContainer
                }
              >
                {galleryAlbums.map(
                  (album) => {
                    /*
                     * Exactly first 3
                     * photos on main page.
                     */
                    const previewPhotos =
                      album.images.slice(
                        0,
                        3,
                      );

                    return (
                      <View
                        key={
                          album.id
                        }
                        style={
                          styles.albumSection
                        }
                      >
                        {/* ============================= */}
                        {/* BLACK BOLD HEADING */}
                        {/* ============================= */}

                        <View
                          style={
                            styles.albumHeader
                          }
                        >
                          <View
                            style={
                              styles.albumHeaderContent
                            }
                          >
                            <Text
                              style={
                                styles.albumTitle
                              }
                            >
                              {
                                album.name
                              }
                            </Text>

                            {album.description?.trim() ? (
                              <Text
                                style={
                                  styles.albumDescription
                                }
                                numberOfLines={
                                  2
                                }
                              >
                                {
                                  album.description
                                }
                              </Text>
                            ) : null}
                          </View>

                          <Pressable
                            onPress={() =>
                              openAlbum(
                                album,
                              )
                            }
                            style={({
                              pressed,
                            }) => [
                              styles.viewAllButton,

                              pressed &&
                                styles.pressed,
                            ]}
                          >
                            <Text
                              style={
                                styles.viewAllText
                              }
                            >
                              View All
                            </Text>

                            <Text
                              style={
                                styles.viewAllArrow
                              }
                            >
                              ›
                            </Text>
                          </Pressable>
                        </View>

                        {/* ============================= */}
                        {/* LINE UNDER HEADING */}
                        {/* ============================= */}

                        <View
                          style={
                            styles.albumDivider
                          }
                        />

                        {/* ============================= */}
                        {/* FIRST THREE PHOTOS */}
                        {/* ============================= */}

                        <View
                          style={
                            styles.albumPreviewGrid
                          }
                        >
                          {previewPhotos.map(
                            (
                              item,
                              index,
                            ) => (
                              <Pressable
                                key={
                                  item.id
                                }
                                onPress={() =>
                                  openImage(
                                    index,
                                    album,
                                  )
                                }
                                style={({
                                  pressed,
                                }) => [
                                  styles.albumPreviewCard,

                                  pressed &&
                                    styles.galleryItemPressed,
                                ]}
                              >
                                <Image
                                  source={{
                                    uri: getImageUrl(
                                      item.image_url,
                                    ),
                                  }}
                                  style={
                                    styles.albumPreviewImage
                                  }
                                  resizeMode="cover"
                                />
                              </Pressable>
                            ),
                          )}
                        </View>

                        {/* ============================= */}
                        {/* COUNT */}
                        {/* ============================= */}

                        <View
                          style={
                            styles.albumFooter
                          }
                        >
                          <Text
                            style={
                              styles.albumPhotoCount
                            }
                          >
                            {
                              album
                                .images
                                .length
                            }{' '}
                            {album
                              .images
                              .length ===
                            1
                              ? 'photo'
                              : 'photos'}
                          </Text>

                          {album
                            .images
                            .length >
                            3 && (
                            <Pressable
                              onPress={() =>
                                openAlbum(
                                  album,
                                )
                              }
                            >
                              <Text
                                style={
                                  styles.albumMorePhotos
                                }
                              >
                                +
                                {album
                                  .images
                                  .length -
                                  3}{' '}
                                more
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  },
                )}
              </View>
            )}

            {/* ========================================= */}
            {/* VIDEOS */}
            {/* ========================================= */}

            


            
                

   
          </>
        )}
      </ScrollView>

      {/* ============================================= */}
      {/* FULL-SCREEN IMAGE VIEWER */}
      {/* ============================================= */}

      <Modal
        visible={
          selectedImage !== null
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeImage
        }
        statusBarTranslucent
      >
        <View
          style={
            styles.modalContainer
          }
        >
          <StatusBar
            barStyle="light-content"
            backgroundColor="#080706"
          />

          {/* TOP BAR */}

          <View
            style={
              styles.modalTopBar
            }
          >
            <Pressable
              onPress={
                closeImage
              }
              style={({
                pressed,
              }) => [
                styles.closeButton,

                pressed &&
                  styles.modalPressed,
              ]}
            >
              <Text
                style={
                  styles.closeButtonText
                }
              >
                ×
              </Text>
            </Pressable>

            <View
              style={
                styles.modalCounter
              }
            >
              <Text
                style={
                  styles.modalCounterText
                }
              >
                {selectedImageIndex !==
                null
                  ? selectedImageIndex +
                    1
                  : 1}{' '}
                / {viewerImages.length}
              </Text>
            </View>
          </View>

          {/* IMAGE */}

          {selectedImage && (
            <View
              style={
                styles.modalImageContainer
              }
            >
              <Image
                source={{
                  uri: getImageUrl(
                    selectedImage.image_url,
                  ),
                }}
                style={
                  styles.modalImage
                }
                resizeMode="contain"
              />
            </View>
          )}

          {/* PREVIOUS */}

          {viewerImages.length >
            1 && (
            <Pressable
              onPress={
                previousImage
              }
              style={({
                pressed,
              }) => [
                styles.navigationButton,
                styles.previousButton,

                pressed &&
                  styles.modalPressed,
              ]}
            >
              <Text
                style={
                  styles.navigationText
                }
              >
                ‹
              </Text>
            </Pressable>
          )}

          {/* NEXT */}

          {viewerImages.length >
            1 && (
            <Pressable
              onPress={
                nextImage
              }
              style={({
                pressed,
              }) => [
                styles.navigationButton,
                styles.nextButton,

                pressed &&
                  styles.modalPressed,
              ]}
            >
              <Text
                style={
                  styles.navigationText
                }
              >
                ›
              </Text>
            </Pressable>
          )}

          {/* SHARE / DOWNLOAD */}

          <View
            style={
              styles.imageActionsBar
            }
          >
            <Pressable
              onPress={
                shareSelectedImage
              }
              disabled={
                imageActionLoading !==
                null
              }
              style={({
                pressed,
              }) => [
                styles.imageActionButton,

                pressed &&
                  styles.modalPressed,

                imageActionLoading !==
                  null &&
                  styles.imageActionDisabled,
              ]}
            >
              <Text
                style={
                  styles.imageActionIcon
                }
              >
                ↗
              </Text>

              <Text
                style={
                  styles.imageActionText
                }
              >
                {imageActionLoading ===
                'share'
                  ? 'Sharing...'
                  : 'Share'}
              </Text>
            </Pressable>

            <Pressable
              onPress={
                downloadSelectedImage
              }
              disabled={
                imageActionLoading !==
                null
              }
              style={({
                pressed,
              }) => [
                styles.imageActionButton,

                pressed &&
                  styles.modalPressed,

                imageActionLoading !==
                  null &&
                  styles.imageActionDisabled,
              ]}
            >
              <Text
                style={
                  styles.imageActionIcon
                }
              >
                ↓
              </Text>

              <Text
                style={
                  styles.imageActionText
                }
              >
                {imageActionLoading ===
                'download'
                  ? 'Saving...'
                  : 'Download'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  /* ================================================= */
  /* CONTAINER */
  /* ================================================= */

  container: {
    flex: 1,
    backgroundColor: '#FFF9F0',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 45,
  },

  pressed: {
    opacity: 0.72,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  galleryItemPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  cardPressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  /* ================================================= */
  /* LOADING / ERROR */
  /* ================================================= */

  loadingContainer: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: '#766A61',
  },

  emptyContainer: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#432717',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#766A61',
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8EBDD',
  },

  retryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A85D25',
  },

  noPhotosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 10,
  },

  noPhotosTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#432717',
    marginBottom: 6,
  },

  noPhotosText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#81756B',
    textAlign: 'center',
  },

  /* ================================================= */
  /* MAIN HEADER */
  /* ================================================= */

  header: {
    marginBottom: 25,
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: '#B66A2C',
    marginBottom: 6,
  },

  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: '#432717',
    letterSpacing: -0.7,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#766A61',
    marginTop: 6,
    maxWidth: 320,
  },

  /* ================================================= */
  /* GENERIC SECTION HEADER */
  /* ================================================= */

  sectionHeaderStandalone: {
    marginTop: 28,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#432717',
    letterSpacing: -0.2,
  },

  sectionCaption: {
    fontSize: 11,
    color: '#8A7C70',
    marginTop: 3,
  },

  /* ================================================= */
  /* VIEW ALL BUTTON */
  /* ================================================= */

  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8EBDD',
  },

  viewAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A85D25',
  },

  viewAllArrow: {
    fontSize: 20,
    lineHeight: 18,
    color: '#A85D25',
    marginLeft: 3,
  },

  /* ================================================= */
  /* DYNAMIC ALBUM SECTIONS */
  /* ================================================= */

  albumSectionsContainer: {
    width: '100%',
  },

  albumSection: {
    width: '100%',
    marginBottom: 30,
  },

  /*
   * Temple Entrance                  View All
   */
  albumHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  albumHeaderContent: {
    flex: 1,
    paddingRight: 12,
  },

  /*
   * Requested:
   * Heading should be black + bold.
   */
  albumTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: '#171717',
    letterSpacing: -0.25,
  },

  albumDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#81756B',
    marginTop: 3,
  },

  /*
   * Divider below heading.
   */
  albumDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E8DDD3',
    marginTop: 11,
    marginBottom: 13,
  },

  /*
   * Three images horizontally.
   */
  albumPreviewGrid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },

  albumPreviewCard: {
    width: '31.7%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E8D7C5',

    shadowColor: '#4A2C18',
    shadowOpacity: 0.07,
    shadowRadius: 5,

    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 2,
  },

  albumPreviewImage: {
    width: '100%',
    height: '100%',
  },

  albumFooter: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  albumPhotoCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A7C70',
  },

  albumMorePhotos: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A85D25',
  },

  /* ================================================= */
  /* SELECTED ALBUM HEADER */
  /* ================================================= */

  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  backButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,

    shadowColor: '#4A2C18',
    shadowOpacity: 0.08,
    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 3,
  },

  backArrow: {
    fontSize: 31,
    lineHeight: 34,
    color: '#432717',
    marginTop: -3,
  },

  galleryHeaderText: {
    flex: 1,
  },

  galleryEyebrow: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#B66A2C',
    marginBottom: 3,
  },

  galleryPageTitle: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800',
    color: '#171717',
  },

  galleryPageSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: '#82766C',
    marginTop: 2,
  },

  photoCount: {
    width: 54,
    height: 51,
    borderRadius: 16,
    backgroundColor: '#F8EBDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  photoCountNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#A85D25',
  },

  photoCountLabel: {
    fontSize: 6.5,
    fontWeight: '900',
    color: '#A85D25',
    letterSpacing: 0.7,
  },

  /* ================================================= */
  /* FULL ALBUM GALLERY */
  /* ================================================= */

  fullGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  fullGalleryWrapper: {
    width: '48.5%',
    marginBottom: 16,
  },

  fullGalleryItem: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E7D5C0',

    shadowColor: '#4A2C18',
    shadowOpacity: 0.08,
    shadowRadius: 8,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  fullGalleryImage: {
    width: '100%',
    height: '100%',
  },

  galleryTextContainer: {
    paddingHorizontal: 4,
    paddingTop: 7,
  },

  fullGalleryTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#432717',
  },

  fullGalleryDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: '#7D7066',
    marginTop: 3,
  },

  galleryBottomSpace: {
    height: 20,
  },

  /* ================================================= */
  /* VIDEOS */
  /* ================================================= */

  videoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    marginBottom: 11,

    shadowColor: '#4A2C18',
    shadowOpacity: 0.07,
    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 2,
  },

  videoThumbnail: {
    width: 100,
    height: 82,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EBD7C0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  playButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },

  playIcon: {
    fontSize: 15,
    color: '#A85D25',
  },

  videoDuration: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(20,12,8,0.72)',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 6,
  },

  videoDurationText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
  },

  videoContent: {
    flex: 1,
    paddingLeft: 12,
    paddingVertical: 4,
    justifyContent: 'center',
  },

  videoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#432717',
    marginBottom: 4,
  },

  videoDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: '#81756B',
  },

  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  watchText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A85D25',
  },

  watchArrow: {
    fontSize: 18,
    color: '#A85D25',
    marginLeft: 2,
  },

  /* ================================================= */
  /* STOTRAS */
  /* ================================================= */

  stotraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 15,

    shadowColor: '#4A2C18',
    shadowOpacity: 0.06,
    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 2,
  },

  stotraRow: {
    flexDirection: 'row',
    paddingVertical: 16,
  },

  stotraBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7DE',
  },

  stotraPressed: {
    opacity: 0.65,
  },

  stotraIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#F8EBDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  stotraEmoji: {
    fontSize: 20,
    color: '#A85D25',
    fontWeight: '700',
  },

  stotraContent: {
    flex: 1,
  },

  stotraTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#432717',
    marginBottom: 4,
  },

  stotraDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: '#7D7066',
  },

  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  readText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A85D25',
  },

  readArrow: {
    fontSize: 17,
    color: '#A85D25',
    marginLeft: 2,
  },

  /* ================================================= */
  /* AUDIO */
  /* ================================================= */

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3DEC5',
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
  },

  infoIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  infoIcon: {
    fontSize: 23,
    color: '#A85D25',
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#432717',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#706258',
  },

  infoArrow: {
    fontSize: 25,
    color: '#A85D25',
    marginLeft: 5,
  },

  /* ================================================= */
  /* FULL SCREEN IMAGE VIEWER */
  /* ================================================= */

  modalContainer: {
    flex: 1,
    backgroundColor: '#080706',
  },

  modalTopBar: {
    position: 'absolute',
    zIndex: 10,
    top: 45,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  closeButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '300',
    marginTop: -3,
  },

  modalCounter: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },

  modalCounterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  modalImageContainer: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    bottom: 105,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
  },

  navigationButton: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.48,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  previousButton: {
    left: 14,
  },

  nextButton: {
    right: 14,
  },

  navigationText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '300',
    marginTop: -3,
  },

  imageActionsBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },

  imageActionButton: {
    minWidth: 125,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageActionIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginRight: 7,
  },

  imageActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  imageActionDisabled: {
    opacity: 0.55,
  },

  modalPressed: {
    opacity: 0.55,
    transform: [
      {
        scale: 0.94,
      },
    ],
  },
});