const type = require("../models/types");
const supplier = require("../models/suppliers");
const product = require("../models/products");
const customers = require("../models/customers");
const region = require('../models/region');
const bill = require('../models/bills');
const OjectId = require('mongodb').ObjectId;
const querystring = require("qs");
const sha256 = require("sha256");
const formatDate = require('date-and-time');


const tmnCode = "7EH8TCJO";
const secretKey = "JAXJBTTFSSTFNGHLOFOCHYOLWPULIKHP";
const url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const returnUrl = "http://localhost:3000/orderSuccess";

const  sortObject =(o) => {
  var sorted = {},
    key,
    a = [];

  for (key in o) {
    if (o.hasOwnProperty(key)) {
      a.push(key);
    }
  }

  a.sort();

  for (key = 0; key < a.length; key++) {
    sorted[a[key]] = o[a[key]];
  }
  return sorted;
}

class IndexController {
  index(req, res, next) {
    type.find({}, (err, result) => {
      if (req.isAuthenticated()) {
        customers.findOne({ 'loginInformation.userName': req.session.passport.user.username }, (err, customerResult) => {
          res.render("index", { data: result, message: req.flash("success"), customer: customerResult });
        })
      } else {
        res.render("index", { data: result, message: req.flash("success"), customer: undefined });
      }
    });
  }
  getLoginPage(req, res, next) {
    var messageError = req.flash("error");
    var messageSuccess = req.flash("success");
    res.render("loginuser", { message: messageError.length != 0 ? messageError : messageSuccess, typeMessage:  messageSuccess.length != 0 ? 'success': 'error'});
  }
  getCartPage(req, res, next) {
    if (req.isAuthenticated()) {
      customers.findOne(
        { "loginInformation.userName": req.session.passport.user.username },
        (err, customerResult) => {
          res.render("cart", { customer: customerResult, message: req.flash('success') });
        }
      );
    } else {
      res.redirect("/login");
    }
  }
  getAddToCartSingle(req, res, next) {
    if (req.isAuthenticated()) {
      var id = req.params.id;
      var user = req.session.passport.user.username;
      product.findOne({ _id: id }, (err, productResult) => {
        customers
          .findOneAndUpdate(
            { "loginInformation.userName": user },
            {
              $push: {
                listProduct: [
                  {
                    productID: productResult._id.toString(),
                    productName: productResult.productName,
                    productPrice: productResult.description.price,
                    productImage: productResult.description.imageList[0],
                    amount: 1,
                  },
                ],
              },
            }
          )
          .then(() => {
            req.flash("success", "Sản phẩm đã thêm vào giỏ!");
            res.redirect(`/product/`);
          })
          .catch((err) => {
            console.log(err);
            req.flash("error", "Lỗi khi thêm sản phẩm vào giỏ!");
            next();
          });
      });
    } else {
      res.redirect("/login");
    }
  }
  postAddToCartMulti(req, res, next) {
    if (req.isAuthenticated()) {
      var id = req.params.id;
      var user = req.session.passport.user.username;
      var amount = req.body.quantity ? req.body.quantity : 1;
      product.findOne({ _id: id }, (err, productResult) => {
        customers
          .findOneAndUpdate(
            { "loginInformation.userName": user },
            {
              $push: {
                listProduct: [
                  {
                    productID: productResult._id.toString(),
                    productName: productResult.productName,
                    productPrice: productResult.description.price,
                    productImage: productResult.description.imageList[0],
                    amount: amount,
                  },
                ],
                customers: [
                  {
                    customerID: customerResult._id.toString(),
                    customerName: customerResult.fullNameCustomer.lastName,
                    customerPrice: customerResult.fullNameCustomer.lastName.email,                                    
                    customerImage: customerResult.avatar,
                    amount: amount,
                  },
                ]
              },             
              
            }
          )
          .then(() => {
            req.flash("success", "Sản phẩm đã thêm vào giỏ!");
            res.redirect(`/product/`);
          })
          .catch((err) => {
            console.log(err);
            req.flash("error", "Lỗi khi thêm sản phẩm vào giỏ!");
            next();
          });
      });
    } else {
      res.redirect("/login");
    }
  }
  postUpdateQTYInCart(req, res, next) {
    var id = req.params.id;
    var quantity = parseInt(req.body.amount);
    var user = req.session.passport.user.username;
    customers.updateOne({ "loginInformation.userName": user, "listProduct.productID": id }, { $set: { "listProduct.$.amount": quantity } })
      .then(() => {
        res.redirect('/cart');
      })
      .catch((err) => {
        console.log(err);
      });
  }
  getDeleteProductInCart(req, res, next) {
    if (req.isAuthenticated()) {
      var id = req.params.id;
      var user = req.session.passport.user.username;
      customers.updateMany({ 'loginInformation.userName': user }, { $pull: { listProduct: { productID: id } } })
        .then(() => {
          req.flash("success", "Đã xóa sản phẩm khỏi giỏ!");
          res.redirect('/cart');
        })
        .catch((err) => {
          console.log(err);
          next();
        });
    } else {
      res.redirect('/login');
    }
  }
  getCheckoutPage(req, res, next) {
    if (req.isAuthenticated()) {
      var user = req.session.passport.user.username;
      customers.findOne({ 'loginInformation.userName': user }, (err, customerResult) => {
        res.render("checkout", { customer: customerResult });
      });
    } else {
      res.redirect('/login');
    }
  }
  getPayOnline(req, res, next) {
    if (req.isAuthenticated()) {
      var user = req.session.passport.user.username;
      customers.findOne({ 'loginInformation.userName': user }, (err, customerResult) => {
        res.render("pay-online", { customer: customerResult });
      });
    } else {
      res.redirect('/login');
    }
  }
  postPayOnline(req, res, next) {
    if (req.isAuthenticated()) {
      var user = req.session.passport.user.username;
      const id = req.params.id;

      customers.findOne({ 'loginInformation.userName': user }, (err, customerResult) => {
        const totalPrice = customerResult.listProduct.reduce((total,item) => total+(item.amount * Number(item.productPrice)),0)
      
      var data = {status: 'Chuẩn bị hàng'}
      bill.findOneAndUpdate({_id: id}, data, {new: true})

      let ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    let vnpUrl = url;
    const date = new Date();

    const createDate = formatDate.format(date, "YYYYMMDDHHmmss");
    const orderId = id;
    // var orderId = dateFormat(date, 'HHmmss');

    var locale = "vn";
    var currCode = "VND";
    var vnp_Params = {};
    vnp_Params["vnp_Version"] = "2";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;

    vnp_Params["vnp_Locale"] = locale;
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = orderId;
    vnp_Params["vnp_OrderInfo"] = "Nap tien cho thue bao 0123456789";
    vnp_Params["vnp_OrderType"] = "billpayment";
    vnp_Params["vnp_Amount"] = (totalPrice + 100000) * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;
    vnp_Params["vnp_BankCode"] = "NCB";

    vnp_Params = sortObject(vnp_Params);

    var signData =
      secretKey + querystring.stringify(vnp_Params, { encode: false });

    var secureHash = sha256(signData);

    vnp_Params["vnp_SecureHashType"] = "SHA256";
    vnp_Params["vnp_SecureHash"] = secureHash;
    vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });

      // res.status(200).json({ code: "00", data: vnpUrl });
        console.log(vnpUrl)
        res.redirect(vnpUrl)
        
      });


    } else {
      res.redirect('/login');
    }
  }
  postCheckout(req, res, next) {
    if (req.isAuthenticated()) {
      var user = req.session.passport.user.username;
      var city = req.body.city;
      var district = req.body.district;
      var ward = req.body.ward;
      var address = req.body.address;
      const checkType = parseInt(req.body.payment);
      if (checkType == 1) {
        customers.findOne({ 'loginInformation.userName': user }, (err, customerResult) => {
          region.findOne({Id: city}, (err, cityResult) => {
            var cityName = cityResult.Name;
            var districtData = cityResult.Districts.filter(e => e.Id == district);
            var districtName = districtData[0].Name;
            var wardName = districtData[0].Wards.filter(e => e.Id == ward)[0].Name;
            var data = {
              'userID': customerResult._id,
              'displayName': customerResult.fullNameCustomer,
              'listProduct': customerResult.listProduct,
              'address': `${address}, ${wardName}, ${districtName}, ${cityName}`,
              'paymentMethod': parseInt(req.body.payment) == 1 ? "Thanh toán khi nhận hàng" : "Paypal",
              'resquest': req.body.comment,
              'status': 'Chờ xác nhận'
            }
            var newBill = new bill(data);
            newBill.save(data)
              .then(() => {
                console.log(newBill)
                req.flash('success', 'Đặt hàng thành công!');
                res.redirect('/cart');
              })
              .catch((err) => {
                console.log(err);
                next();
            });
          })
        })
      } else {
        customers.findOne({ 'loginInformation.userName': user }, (err, customerResult) => {
          region.findOne({Id: city}, (err, cityResult) => {
            var cityName = cityResult.Name;
            var districtData = cityResult.Districts.filter(e => e.Id == district);
            var districtName = districtData[0].Name;
            var wardName = districtData[0].Wards.filter(e => e.Id == ward)[0].Name;
            var data = {
              'userID': customerResult._id,
              'displayName': customerResult.fullNameCustomer,
              'listProduct': customerResult.listProduct,
              'address': `${address}, ${wardName}, ${districtName}, ${cityName}`,
              'paymentMethod': parseInt(req.body.payment) == 1 ? "Thanh toán khi nhận hàng" : "Paypal",
              'resquest': req.body.comment,
              'status': 'Chờ xác nhận'
            }
            var newBill = new bill(data);
            newBill.save(data)
              .then(() => {
                console.log(newBill)
                // req.flash('success', 'Đặt hàng thành công!');
                // res.redirect(`/pay-online/${newBill._id}`);
                res.render(`pay-online`, {
                  idBill: newBill._id
                });
              })
              .catch((err) => {
                console.log(err);
                next();
            });
          })
        })
      }

    } else {
      res.redirect('/login');
    }
  }
  getSuccess(req, res, next) {
    if (req.isAuthenticated()) {
      var user = req.session.passport.user.username;
      customers.findOne({ 'loginInformation.userName': user }, (err, customerResult) => {
        res.render("pay-success");
      });
    } else {
      res.redirect('/login');
    }
  }
  search(req, res, next) {
    var key = req.query.search;
    type.find({}, (err, typeResult) => {
      supplier.find({}, (err, supplierResult) => {
        product.find(
          { productName: { $regex: key, $options: "i" } },
          (err, productResult) => {
            if (req.isAuthenticated()) {
              customers.findOne({ 'loginInformation.userName': req.session.passport.user.username }, (err, customerResult) => {
                res.render("search", {
                  types: typeResult,
                  suppliers: supplierResult,
                  products: productResult,
                  key: key,
                  customer: customerResult
                });
              });
            } else {
              res.render("search", {
                types: typeResult,
                suppliers: supplierResult,
                products: productResult,
                key: key,
                customer: undefined
              });
            }

          }
        );
      });
    });
  }
  getRegisterPage(req, res, next) {
    res.render('sign-up', {message: req.flash('success').length != 0 ? req.flash('success') : req.flash('error')});
  }
  postRegisterUser(req, res, next) {
    var firstname = req.body.firstname;
    var lastname = req.body.lastname;
    var username = req.body.username;
    var phone = req.body.phone;
    var cmnd = req.body.cmnd;
    var email = req.body.email;
    var password = req.body.password;
    var re_password = req.body.repassword;
    customers.findOne({ 'loginInformation.userName': username }, (err, customerResult) => {
      if (customerResult) {
        req.flash('error', 'Tài khoản đã tồn tại!');
        res.redirect('/sign-up')
      } else {
        var data = {
          'fullNameCustomer': {'firstName': firstname, 'lastName': lastname},
          'dateOfBirth': null,
          'sex': null,
          'identityCardNumber': cmnd,
          'address': null,
          'phoneNumber': phone,
          'email': email,
          'listProduct': [],
          'listFavorite': [],
          'loginInformation': {'userName': username, 'password': password, 'type': 'User', roles: []},
          'avatar': '/uploads/user-01.png'
        }
        var newUser = new customers(data);
        newUser.save()
        .then(() => {
          req.flash('success', 'Tạo tài khoản thành công!');
          res.redirect('/login');
        })
        .catch((err) => {
          console.log(err);
          req.flash('error', 'Tạo tài khoản không thành công!');
          res.redirect('/login');
        });
      }
    });
  }
  getAddFavorite(req, res, next) {
    if (req.isAuthenticated()) {
      var id = req.params.id;
      var user = req.session.passport.user.username;
      product.findOne({ _id: id }, (err, productResult) => {
        customers
          .findOneAndUpdate(
            { "loginInformation.userName": user },
            {
              $push: {
                listFavorite: [
                  productResult
                ],
              },
            }
          )
          .then(() => {
            req.flash("success", "Đã thêm vào danh sách yêu thích!");
            res.redirect(`/product/`);
          })
          .catch((err) => {
            console.log(err);
            req.flash("error", "Lỗi khi thêm sản phẩm vào danh sách yêu thích!");
            next();
          });
      });
    } else {
      res.redirect("/login");
    }
  }
  getFavoritePage(req, res, next) {
    var itemsPerPage = 6;
    if(req.isAuthenticated()) {
      customers.findOne({'loginInformation.userName': req.session.passport.user.username}, (err, customerResult) => {
        type.find({}, (err, data) => {
          supplier.find({}, (err, supplier) => {
            res.render("favorites", {
              data: customerResult.listFavorite,
              types: data,
              suppliers: supplier,
              itemsPerPage: itemsPerPage,
              currentPage: 1,
              message: req.flash('success'),
              customer: customerResult
            });
          });
        });
      });
    } else {
      res.redirect('/login');
    }
  }
  getFavoriteAtPage(req, res, next) {
    var itemsPerPage = 6;
    var page = req.params.page;
    if(req.isAuthenticated()) {
      customers.findOne({'loginInformation.userName': req.session.passport.user.username}, (err, customerResult) => {
        type.find({}, (err, data) => {
          supplier.find({}, (err, supplier) => {
            res.render("favorites", {
              data: customerResult.listFavorite,
              types: data,
              suppliers: supplier,
              itemsPerPage: itemsPerPage,
              currentPage: page,
              message: req.flash('success'),
              customer: customerResult
            });
          });
        });
      });
    } else {
      res.redirect('/login');
    }
  }
  getDeleteFavorite(req, res, next) {
    if (req.isAuthenticated()) {
      var id = req.params.id;
      var user = req.session.passport.user.username;
      customers.updateMany({ 'loginInformation.userName': user }, { $pull: { listFavorite: { _id: OjectId(id) } } })
        .then(() => {
          req.flash("success", "Đã sản phẩm khỏi yêu thích!");
          res.redirect('/favorite');
        })
        .catch((err) => {
          console.log(err);
          next();
        });
    } else {
      res.redirect('/login');
    }
  }

  getIntroducePage (req,res) {
    console.log(req.session.passport);
    res.render("introduce", {customer: null})
  }

  getContactPage (req,res) {
    res.render("contact",{customer: null})
  }
}

module.exports = new IndexController();
