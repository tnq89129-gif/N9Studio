(async () => {
  if (!await window.shopReady) return;

  const searchInput = document.getElementById("review-search");
  const statusFilter = document.getElementById("review-filter");
  const ratingFilter = document.getElementById("rating-filter");
  const reviewList = document.getElementById("reviews-list");
  const errorMessage = document.getElementById("reviews-error");
  let reviews = [];



  function showError(error) {
    console.error("Không thể tải danh sách đánh giá:", error);
    errorMessage.textContent = error instanceof SyntaxError
      ? "Dữ liệu đánh giá trong trình duyệt bị lỗi định dạng. Hãy khôi phục dữ liệu reviews trước khi tiếp tục."
      : error.message || "Không thể đọc dữ liệu đánh giá.";
    errorMessage.hidden = false;
  }



  function formatRating(value) {
    const rating = Number(value);
    return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
  }

  function createReviewRow(review, index) {
    const row = document.createElement("tr");
    const productCell = document.createElement("td");
    const productName = document.createElement("strong");
    productName.className = "review-product-name";
    productName.textContent = review.productName || review.productId;
    const productId = document.createElement("small");
    productId.className = "review-product-id";
    productId.textContent = review.productId;
    productCell.append(productName, productId);

    const customerCell = document.createElement("td");
    const customerName = document.createElement("strong");
    customerName.className = "review-customer-name";
    customerName.textContent = review.name;
    const reviewType = document.createElement("small");
    reviewType.className = "review-type";
    reviewType.textContent = review.isSample ? "Nội dung minh họa" : "Khách hàng";
    customerCell.append(customerName, reviewType);

    const ratingCell = document.createElement("td");
    const stars = document.createElement("span");
    stars.className = "review-rating";
    stars.textContent = formatRating(review.rating);
    stars.setAttribute("aria-label", `${review.rating} trên 5 sao`);
    const number = document.createElement("small");
    number.className = "review-rating-number";
    number.textContent = `${review.rating}/5`;
    ratingCell.append(stars, number);

    const commentCell = document.createElement("td");
    commentCell.className = "review-comment-cell";
    commentCell.textContent = review.comment;

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "product-state";
    status.dataset.published = String(review.published !== false);
    status.textContent = review.published === false ? "Đang ẩn" : "Đang hiển thị";
    statusCell.append(status);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "product-row-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "row-action";
    toggle.dataset.action = "toggle";
    toggle.dataset.reviewIndex = String(index);
    toggle.textContent = review.published === false ? "Hiện" : "Ẩn";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "row-action row-action--delete";
    remove.dataset.action = "delete";
    remove.dataset.reviewIndex = String(index);
    remove.textContent = "Xóa";
    actions.append(toggle);
    actionsCell.append(actions);

    row.append(productCell, customerCell, ratingCell, commentCell, statusCell, actionsCell);
    return row;
  }

  function renderReviews() {
    const query = searchInput.value.trim().toLocaleLowerCase("vi");
    const status = statusFilter.value;
    const selectedRating = ratingFilter.value;
    const visibleReviews = reviews
      .map((review, index) => ({ review, index }))
      .filter(({ review }) => {
        const searchable = `${review.productName || review.productId} ${review.productId} ${review.name} ${review.comment}`
          .toLocaleLowerCase("vi");
        const matchesQuery = searchable.includes(query);
        const isPublished = review.published !== false;
        const matchesStatus = status === "all" ||
          (status === "published" && isPublished) ||
          (status === "hidden" && !isPublished);
        const matchesRating = selectedRating === "all" || Number(review.rating) === Number(selectedRating);
        return matchesQuery && matchesStatus && matchesRating;
      });

    reviewList.replaceChildren(...visibleReviews.map(({ review, index }) => createReviewRow(review, index)));
    document.getElementById("reviews-count").textContent =
      `${visibleReviews.length} / ${reviews.length} nhận xét`;
    document.getElementById("total-reviews").textContent = String(reviews.length);
    const published = reviews.filter((review) => review.published !== false);
    const hiddenCount = reviews.length - published.length;
    document.getElementById("published-reviews").textContent = String(published.length);
    document.getElementById("hidden-reviews").textContent = String(hiddenCount);
    const average = published.length
      ? published.reduce((total, review) => total + Number(review.rating), 0) / published.length
      : null;
    document.getElementById("average-rating").textContent = average === null ? "—" : `${average.toFixed(1)} / 5`;
    document.getElementById("reviews-empty").hidden = visibleReviews.length !== 0;
  }

  async function loadReviews() {
    try {
      reviews=(await shop.all('/api/quan-tri/danh-gia')).map(r=>({...r,id:String(r.id),productId:String(r.productId),name:r.fullName,comment:r.content,published:r.isVisible}));
      errorMessage.hidden=true;renderReviews();
    }catch(e){reviews=[];renderReviews();shop.error(e,errorMessage);}
  }

  reviewList.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action="toggle"]');if(!button)return;
    const review=reviews[Number(button.dataset.reviewIndex)];if(!review)return;
    await shop.action(button,async()=>{
      await shop.request('/api/quan-tri/danh-gia/'+review.id,'PUT',{isVisible:!review.published});
      await loadReviews();showSuccess('Đã cập nhật hiển thị đánh giá.');
    },e=>shop.error(e,errorMessage));
  });

  function showSuccess(message) {
    const feedback = document.getElementById("reviews-feedback");
    feedback.textContent = message;
    feedback.hidden = false;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedback.hidden = true;
    }, 3200);
  }

  let feedbackTimer;
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
  searchInput.addEventListener("input", renderReviews);
  statusFilter.addEventListener("change", renderReviews);
  ratingFilter.addEventListener("change", renderReviews);
  document.getElementById("refresh-button").addEventListener("click", loadReviews);
  loadReviews();
})();
